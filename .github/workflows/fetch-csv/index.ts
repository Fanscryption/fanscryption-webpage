import {google} from "googleapis";
import {createWriteStream, existsSync, writeFileSync} from "fs";

const auth = new google.auth.GoogleAuth({
    keyFile: './credentials.json',
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly', 'https://www.googleapis.com/auth/drive.readonly', 'https://www.googleapis.com/auth/drive.metadata.readonly'],
});

const drive = google.drive({
    version: 'v3',
    auth: auth,
});

const sheets = google.sheets({
    version: 'v4',
    auth: auth,
});


interface ImageMetadata {
    mimeType: 'image/jpeg' | 'image/png' | 'image/webp',
    id: string,
    name: string,
    imageMediaMetadata: {
        width: number,
        height: number,
        rotation: number,
    },
}

const folderIds = [process.env.FOLDER_1_ID!, process.env.FOLDER_2_ID!];
const metadatas: ImageMetadata[] = [];
for (const folderId of folderIds) {
    let res = await drive.files.list({
        q: `'${folderId}' in parents`,
        fields: 'files(id, name, mimeType, imageMediaMetadata)',
    })

    let files = res.data.files
    if (!files) {
        throw 'could not fetch data from api.';
    }

    files = files.filter(file => {
        const isImage = file.mimeType === 'image/jpeg' || file.mimeType === 'image/png' || file.mimeType === 'image/webp';
        if (!isImage) {
            console.log(`skipping ${file.name} because it is not an image`, file.mimeType);
            return false
        }
        return true;
    })
    metadatas.push(...files as ImageMetadata[]);
}
const metadatasMap: Record<string, ImageMetadata> = metadatas.reduce((acc, metadata) => {
    acc[metadata.id] = metadata;
    return acc;
}, {} as Record<string, ImageMetadata>);
writeFileSync('../../../assets/data/images-metadata.json', JSON.stringify(metadatasMap, null, 2));


const res = await sheets.spreadsheets.values.get(
    {
        spreadsheetId: process.env.SHEET_1_ID!,
        range: 'Responses!A:L',
    }
);


const rows = res.data.values;
if (!rows) {
    throw 'could not fetch data from api.';
}

rows.shift(); // remove first line

const ret = [];
for (const row of rows) {
    const approved = row[11] === 'Approved';
    if (!approved) {
        continue;
    }

    const date = new Date(row[0]);
    const timestamp = date.getTime() / 1000;

    const type = row[1];
    const title = row[2];
    const description = row[3];

    const primaryImageURL = row[4].replace('https://drive.google.com/open?id=', '');
    const additionalImageURLs = row[5].split(',').map((url: string) => url.trim().replace('https://drive.google.com/open?id=', '')).filter(s => s !== '');

    const hasAdditionalImages = row[6] !== 'No, I uploaded all the pictures I had';

    const socialsRaw = row[7];
    const socials = socialsRaw.match(/https:\/\/.*?(?=\s|$)/g)?.[0] ?? '';

    const additionalLinks = row[8];

    const canShare = row[9];
    const discordUsername = row[10];

    const d = {
        timestamp,
        type,
        title,
        description,
        primaryImageURL,
        additionalImageURLs,
        hasAdditionalImages,
        socials,
        additionalLinks,
        canShare,
        discordUsername,
        approved,
    }

    ret.push(d);
}

const json = JSON.stringify(ret, null, 2)
writeFileSync('../../../assets/data/responses.json', json);
console.log('did write; done.')

async function downloadFileId(fileId: string): Promise<void> {

    const filename = filenameFromFileId(fileId, metadatasMap)
    if (!filename) {
        console.error('file not found in metadata', fileId);
        return
    }

    const filePath = '../../../static/art/' + filename;

    let res = await drive.files
        .get({fileId: fileId, alt: 'media'}, {responseType: 'stream'})

    return new Promise((resolve, reject) => {

        console.log(`writing to ${filePath}`);
        const dest = createWriteStream(filePath);
        let progress = 0;

        res.data
            .on('end', () => {
                console.log('Done downloading file.');
                resolve();
            })
            .on('error', err => {
                console.error('Error downloading file.');
                reject(err);
            })
            .on('data', d => {
                progress += d.length;
            })
            .pipe(dest);
    });
}

const fileIds = ret.flatMap((d) => [d.primaryImageURL, ...d.additionalImageURLs].filter(Boolean));
console.log(fileIds);


const imagesMetadata: Record<string, {}> = {}

// get all metadata from google api. i think we check the google drive folders, list all files and see how we can get size and type

function filenameFromFileId(fileId: string, metadatas: Record<string, ImageMetadata>) {
    const metadata = metadatas[fileId];
    if (metadata === undefined) {
        return undefined;
    }

    const fileExtension = ((mimeType): "jpg" | "png" | "webp" => {
        switch (mimeType) {
            case 'image/jpeg':
                return 'jpg';
            case 'image/png':
                return 'png';
            case 'image/webp':
                return 'webp';
        }
    })(metadata.mimeType)

    return fileId + '.' + fileExtension;
}

for (const fileId of fileIds) {
    const promises: Promise<void>[] = [];
    const filename = filenameFromFileId(fileId, metadatasMap)

    if (!filename) {
        console.error('file not found in metadata', fileId);
        continue
    }

    if (!existsSync('../../../static/art/' + filename)) {
        const promise = downloadFileId(fileId); // intentionally not awaited
        promises.push(promise);
    }

    await Promise.all(promises);
}