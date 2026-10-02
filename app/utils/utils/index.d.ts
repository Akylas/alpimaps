export * from './index.android';
export async function pickTime(currentDate: Dayjs): Promise<[number, number]>;
export async function pickDate(currentDate: Dayjs): Promise<number>;
export function moveFileOrFolder(sourceLocationPath: string, targetLocationPath: string, androidTargetLocationPath?: string);
export function restartApp();
export function startRefreshAlarm();
export function stopRefreshAlarm();
export function scheduleRefreshAlarm();
export async function askForScheduleAlarmPermission(): Promise<boolean>;
// Mac Catalyst only: persists the picked folder as a security-scoped bookmark
export function setMBTilesFolder(folderUrl: NSURL);
