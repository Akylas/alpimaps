import { pickFolder } from '@nativescript-community/ui-document-picker';
import { ANDROID_30, getAndroidRealPath, getSavedMBTilesDir, setMBTilesFolder, setSavedMBTilesDir } from '~/utils/utils';

/** Elsewhere the folder is fixed. */
export const LOCAL_DATA_FOLDER_PICKABLE = (__ANDROID__ && !PLAY_STORE_BUILD && ANDROID_30) || __CATALYST__;

/** Saves the picked folder as the map data folder; null when none was picked or it did not change. */
export async function pickLocalDataFolder() {
    const result = await pickFolder({
        permissions: {
            read: true,
            persistable: true
        }
    });
    const resultPath = result.folders[0];
    if (!resultPath) {
        return null;
    }
    const folderUrl: NSURL = __CATALYST__ && result.ios.objectAtIndex(0);
    const toUsePath = __CATALYST__ ? folderUrl.path : getAndroidRealPath(resultPath);
    if (toUsePath === getSavedMBTilesDir()) {
        return null;
    }
    if (__CATALYST__) {
        setMBTilesFolder(folderUrl);
    } else {
        setSavedMBTilesDir(toUsePath);
    }
    return toUsePath;
}
