import { knownFolders, File } from "@akylas/nativescript";
import { ShareFile, ShareOptions } from "@nativescript-community/ui-share-file";
const shareFileObject = new ShareFile();

export async function shareFile(content: string, fileName: string, shareOptions:Partial<ShareOptions> = {}) {
    console.log('shareFile',content, fileName, shareOptions)
        const file = knownFolders.temp().getFile(fileName);
        // iOS: using writeText was not adding the file. Surely because it was too soon or something
        // doing it sync works better but still needs a timeout
        // showLoading('loading');
        await file.writeText(content);
        console.log('shareFil2', knownFolders.temp().getFile(fileName).readTextSync())
        return shareFileObject.open({
            path: file.path,
            title: fileName,
            options: true, // optional iOS
            animated: true, // optional iOS,
            ...shareOptions
        });
    }