export * from './index.android';
export async function pickTime(currentDate: Dayjs): Promise<[number, number]>;
export async function pickDate(currentDate: Dayjs): Promise<number>;
export function moveFileOrFolder(sourceLocationPath: string, targetLocationPath: string, androidTargetLocationPath?: string);
export function restartApp();
