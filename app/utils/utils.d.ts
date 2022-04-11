export * from './utils.android';
export async function pickTime(currentDate: Dayjs): Promise<[number, number]>;
export async function pickDate(currentDate: Dayjs): Promise<number>;
