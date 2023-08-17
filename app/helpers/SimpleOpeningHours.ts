const sections = ['su', 'mo', 'tu', 'we', 'th', 'fr', 'sa', 'ph', 'sh'];

function compareTimeArrays(time1: [number, number], time2: [number, number]) {
    const date1 = time1[0] * 100 + time1[1];
    const date2 = time2[0] * 100 + time2[1];
    if (date1 > date2) {
        return 1;
    } else if (date1 < date2) {
        return -1;
    } else {
        return 0;
    }
}
export default class SimpleOpeningHours {
    /**
     * Creates the OpeningHours Object with OSM opening_hours string
     */
    constructor(input: string) {
        this.parse(input);
    }

    public isOpen(date?: Date): boolean {
        if (typeof this.openingHours === 'boolean') {
            return this.openingHours;
        }
        date = date || new Date();
        const testDay = date.getDay();
        // const testTime = date.getHours() + ':' + (date.getMinutes() < 10 ? '0' + date.getMinutes() : date.getMinutes());
        const testTimearray = [date.getHours(), date.getMinutes()] as [number, number];
        let i = 0;
        let times: string[];
        for (const key in this.openingHours) {
            if (i === testDay) {
                times = this.openingHours[key];
            }
            i++;
        }
        let isOpen = false;
        times.some((time) => {
            const timeData = time.replace(/\+$/, '-24:00').split('-');
            const array0 = timeData[0].split(':').map((d) => parseInt(d, 10)) as [number, number];
            const array1 = timeData[1].split(':').map((d) => parseInt(d, 10)) as [number, number];
            if (array1[0] < array0[0]) {
                // span over midnight
                array1[0] += 24;
            }
            const compare1 = compareTimeArrays(testTimearray, array0);
            const compare2 = compareTimeArrays(testTimearray, array1);
            if (compare1 > 0 && compare2 < 0) {
                isOpen = true;
                return true;
            }
        });
        return isOpen;
    }

    public nextTime(date?: Date): Date {
        if (typeof this.openingHours === 'boolean') {
            return null;
        }
        date = date || new Date();
        const testDay = date.getDay();
        // const testTime = date.getHours() + ':' + (date.getMinutes() < 10 ? '0' + date.getMinutes() : date.getMinutes());
        const testTimearray = [date.getHours(), date.getMinutes()] as [number, number];
        let i = 0;
        let times: string[];
        for (const key in this.openingHours) {
            if (i === testDay) {
                times = this.openingHours[key];
            }
            i++;
        }
        let resultDate: Date = null;
        times.some((time, index) => {
            const timeData = time.replace(/\+$/, '-24:00').split('-');
            const array0 = timeData[0].split(':').map((d) => parseInt(d, 10)) as [number, number];
            const array1 = timeData[1].split(':').map((d) => parseInt(d, 10)) as [number, number];
            if (array1[0] < array0[0]) {
                // span over midnight
                array1[0] += 24;
            }
            const compare1 = compareTimeArrays(testTimearray, array0);
            const compare2 = compareTimeArrays(testTimearray, array1);

            if (resultDate) {
                let array = array0;
                const compareDate = new Date(resultDate);
                compareDate.setHours(array[0]);
                compareDate.setMinutes(array[1]);
                if (compareDate.getTime() === resultDate.getTime()) {
                    array = array1;
                    resultDate.setHours(array[0]);
                    resultDate.setMinutes(array[1]);
                    return true;
                }
            }
            if (compare1 > 0 && compare2 < 0) {
                // we are open return close time. Could be timeData[1] except if next time start === timeData[1]
                // happens where time spans spans over midnight
                resultDate = new Date(date);
                const array = array1;
                resultDate.setHours(array[0]);
                resultDate.setMinutes(array[1]);
                if (array[0] === 24 && array[1] === 0) {
                    return false;
                }
                return true;
            } else if (compare1 < 0) {
                // we are close return next opening time
                resultDate = new Date(date);
                const array = array0;
                resultDate.setHours(array[0]);
                resultDate.setMinutes(array[1]);
                return true;
            }
        });
        return resultDate;
    }

    /**
     * Parses the input and creates openingHours Object
     */
    private parse(input: string) {
        if (/^\s*24\s*?\/\s*?7\s*$/.test(input)) {
            this.openingHours = sections.reduce((acc, k) => {
                acc[k] = ['00:00-24:00'];
                return acc;
            }, {});
            this.alwaysOpen = true;
            return;
        } else if (/^.*[0-9]{2}:[0-9]{2}\s*off.*$/.test(input)) {
            this.init();
            return this.parseClosingHours(input);
        } else if (/^\s*off\s*$/.test(input)) {
            this.openingHours = false;
            this.alwaysClosed = true;
            return;
        }
        this.init();
        const parts = input
            .toLowerCase()
            .replace(/\s*([-:,;])\s*/g, '$1')
            .split(';');
        parts.forEach((part) => {
            this.parseHardPart(part);
        });
    }

    private parseClosingHours(input: string) {
        const tempData = sections.reduce((acc, k) => {
            acc[k] = [];
            return acc;
        }, {});

        let univStart;
        let univEnd;
        const parts = input.toLowerCase().split(';');
        for (let p = 0; p < parts.length; p++) {
            parts[p] = parts[p].trim();
            const segments = parts[p].split(' ');
            let days;
            const openTimes = [];
            // If part has the closing hours.
            if (parts[p].indexOf('off') !== -1) {
                // If no start or end time is found yet, add part to the end of the list.
                if (univStart === undefined || univEnd === undefined) {
                    parts.push(parts[p]);
                } else {
                    days = this.parseDays(segments[0]);
                    const closeTimes = [];
                    // Split closing times into array of times.
                    // parts[0]: days, parts[last]: 'off'
                    for (let i = 1; i < segments.length - 1; i++) {
                        segments[i] = segments[i].replace(',', '');
                        const tmp = segments[i].split('-');
                        closeTimes.push(tmp[0]);
                        closeTimes.push(tmp[1]);
                    }
                    // Switch closing hours to opening hours.
                    for (let i = 0; i < closeTimes.length; i++) {
                        if (i === 0) {
                            openTimes.push(univStart + '-' + closeTimes[i]);
                        } else if (i === closeTimes.length - 1) {
                            openTimes.push(closeTimes[i] + '-' + univEnd);
                        } else {
                            openTimes.push(closeTimes[i] + '-' + closeTimes[++i]);
                        }
                    }
                    days.forEach((day) => {
                        tempData[day] = openTimes;
                    });
                }
                // If part has the universal opening hours.
            } else if (segments.length === 1) {
                const tmp = parts[p].split('-');
                univStart = tmp[0];
                univEnd = tmp[1];
                for (const key in tempData) {
                    tempData[key].push(parts[p]);
                }
                // If part has basic opening hours.
            } else {
                const days = this.parseDays(segments[0]);
                openTimes.push(segments[1]);
                days.forEach((day) => {
                    tempData[day] = openTimes;
                });
            }
        }
        for (const key in tempData) {
            this.openingHours[key] = tempData[key];
        }
    }

    private parseHardPart(part: string) {
        if (part === '24/7') {
            part = 'mo-su 00:00-24:00';
        } else if (!isNaN(Number(part[0]))) {
            part = 'mo-su ' + part;
        }
        const segments = part.split(/\ |\,/);

        const tempData = {};
        let days = [];
        let times = [];
        segments.forEach((segment) => {
            if (this.checkDay(segment)) {
                if (times.length === 0) {
                    days = days.concat(this.parseDays(segment));
                } else {
                    //append
                    days.forEach((day) => {
                        if (tempData[day]) {
                            tempData[day] = tempData[day].concat(times);
                        } else {
                            tempData[day] = times;
                        }
                    });
                    days = this.parseDays(segment);
                    times = [];
                }
            }
            if (this.isTimeRange(segment)) {
                if (segment === 'off') {
                    times = [];
                } else {
                    if (times.length && times[times.length - 1].endsWith('24:00') && segment.startsWith('00:00')) {
                        times[times.length - 1] = times[times.length - 1].split('-')[0] + '-' + segment.split('-')[1];
                    } else {
                        times.push(segment);
                    }
                }
            }
        });

        //commit last times to it days
        days.forEach((day) => {
            if (tempData[day]) {
                tempData[day] = tempData[day].concat(times);
            } else {
                tempData[day] = times;
            }
        });

        //apply data to main obj
        for (const key in tempData) {
            this.openingHours[key] = tempData[key];
        }
    }

    private parseDays(part: string): string[] {
        let days = [];
        const softparts = part.split(',');
        softparts.forEach((part) => {
            const rangecount = (part.match(/\-/g) || []).length;
            if (rangecount === 0) {
                days.push(part);
            } else {
                days = days.concat(this.calcDayRange(part));
            }
        });

        return days;
    }

    private init() {
        this.openingHours = sections.reduce((acc, k)=>{
            acc[k] = [];
            return acc;
        }, {});
    }

    /**
     * Calculates the days in range "mo-we" -> ["mo", "tu", "we"]
     */
    private calcDayRange(range: string): string[] {
        const def = {
            su: 0,
            mo: 1,
            tu: 2,
            we: 3,
            th: 4,
            fr: 5,
            sa: 6
        };

        const rangeElements = range.split('-');

        const dayStart = def[rangeElements[0]];
        const dayEnd = def[rangeElements[1]];

        const numberRange = this.calcRange(dayStart, dayEnd, 6);
        const outRange: string[] = [];
        numberRange.forEach((n) => {
            for (const key in def) {
                if (def[key] === n) {
                    outRange.push(key);
                }
            }
        });
        return outRange;
    }

    /**
     * Creates a range between two number.
     * if the max value is 6 a range bewteen 6 and 2 is 6, 0, 1, 2
     */
    private calcRange(min: number, max: number, maxval): number[] {
        if (min === max) {
            return [min];
        }
        let range = [min];
        let rangepoint = min;
        while (rangepoint < (min < max ? max : maxval)) {
            rangepoint++;
            range.push(rangepoint);
        }
        if (min > max) {
            //add from first in list to max value
            range = range.concat(this.calcRange(0, max, maxval));
        }

        return range;
    }

    /**
     * Check if string is time range
     */
    private isTimeRange(input: string): boolean {
        //e.g. 09:00+
        if (input.match(/[0-9]{1,2}:[0-9]{2}\+/)) {
            return true;
        }
        //e.g. 08:00-12:00
        if (input.match(/[0-9]{1,2}:[0-9]{2}\-[0-9]{1,2}:[0-9]{2}/)) {
            return true;
        }
        //off
        if (input.match(/off/)) {
            return true;
        }
        return false;
    }

    /**
     * check if string is day or dayrange
     */
    private checkDay(input: string): boolean {
        if (input.match(/\-/g)) {
            const rangeElements = input.split('-');
            if (sections.indexOf(rangeElements[0]) !== -1 && sections.indexOf(rangeElements[1]) !== -1) {
                return true;
            }
        } else if (sections.indexOf(input) !== -1) {
            return true;
        }
        return false;
    }

    /**
     * Compares to timestrings e.g. "18:00"
     * if time1 > time2 -> 1
     * if time1 < time2 -> -1
     * if time1 === time2 -> 0
     */
    private compareTime(time1: string, time2: string) {
        const date1 = Number(time1.replace(':', ''));
        const date2 = Number(time2.replace(':', ''));

        // const date1 = new Date();
        // const date2 = new Date(date1);

        // let array = time1.split(':').map((d) => parseInt(d, 10));
        // date1.setHours(array[0]);
        // date1.setMinutes(array[1]);
        // array = time2.split(':').map((d) => parseInt(d, 10));
        // date2.setHours(array[0]);
        // date2.setMinutes(array[1]);
        if (date1 > date2) {
            return 1;
        } else if (date1 < date2) {
            return -1;
        } else {
            return 0;
        }
    }

    public openingHours: Object | boolean;
    private alwaysOpen?: boolean;
    private alwaysClosed?: boolean;
}
