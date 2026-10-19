// Just enough of the GTFS-RT protobuf to read trip updates: plain TypeScript, no NativeScript import.
// FeedMessage.entity(2) > FeedEntity.trip_update(3) > TripUpdate{trip(1), stop_time_update(2)}

export interface GtfsStopTimeEvent {
    /** seconds, can be negative */
    delay: number;
    /** epoch seconds */
    time: number;
}

export interface GtfsStopTimeUpdate {
    stopId: string;
    arrival?: GtfsStopTimeEvent;
    departure?: GtfsStopTimeEvent;
    skipped: boolean;
}

export interface GtfsTripUpdate {
    tripId: string;
    cancelled: boolean;
    stopTimeUpdates: GtfsStopTimeUpdate[];
}

const TWO_POW_32 = 4294967296;
const SCHEDULE_RELATIONSHIP_CANCELED = 3;
const SCHEDULE_RELATIONSHIP_SKIPPED = 1;

class Reader {
    pos = 0;
    /** low 32 bits of the last varint: a negative int32 is sent as 10 bytes, too long to hold exactly in a double */
    lastLow = 0;
    constructor(
        private bytes: Uint8Array,
        private end = bytes.length
    ) {}
    get done() {
        return this.pos >= this.end;
    }
    varint() {
        let value = 0;
        let low = 0;
        let factor = 1;
        let byte: number;
        do {
            byte = this.bytes[this.pos++];
            const part = (byte & 0x7f) * factor;
            value += part;
            low = (low + part) % TWO_POW_32;
            factor *= 128;
        } while (byte & 0x80);
        this.lastLow = low;
        return value;
    }
    int32() {
        this.varint();
        return this.lastLow >= TWO_POW_32 / 2 ? this.lastLow - TWO_POW_32 : this.lastLow;
    }
    /** the next field header; `wireType` tells how to read its value */
    tag() {
        const key = this.varint();
        return { field: Math.floor(key / 8), wireType: key % 8 };
    }
    bytesField() {
        const length = this.varint();
        const start = this.pos;
        this.pos += length;
        return { start, end: this.pos };
    }
    skip(wireType: number) {
        switch (wireType) {
            case 0:
                this.varint();
                break;
            case 1:
                this.pos += 8;
                break;
            case 2:
                this.bytesField();
                break;
            case 5:
                this.pos += 4;
                break;
            default:
                throw new Error(`unsupported protobuf wire type ${wireType}`);
        }
    }
    sub(range: { start: number; end: number }) {
        return new Reader(this.bytes, range.end).at(range.start);
    }
    at(pos: number) {
        this.pos = pos;
        return this;
    }
    /** the ids are ASCII: no TextDecoder needed */
    string(range: { start: number; end: number }) {
        let result = '';
        for (let index = range.start; index < range.end; index++) {
            result += String.fromCharCode(this.bytes[index]);
        }
        return result;
    }
}

function parseStopTimeEvent(reader: Reader): GtfsStopTimeEvent {
    const event = { delay: 0, time: 0 };
    while (!reader.done) {
        const { field, wireType } = reader.tag();
        if (field === 1 && wireType === 0) {
            event.delay = reader.int32();
        } else if (field === 2 && wireType === 0) {
            event.time = reader.varint();
        } else {
            reader.skip(wireType);
        }
    }
    return event;
}

function parseStopTimeUpdate(reader: Reader): GtfsStopTimeUpdate {
    const update: GtfsStopTimeUpdate = { stopId: '', skipped: false };
    while (!reader.done) {
        const { field, wireType } = reader.tag();
        if (field === 2 && wireType === 2) {
            update.arrival = parseStopTimeEvent(reader.sub(reader.bytesField()));
        } else if (field === 3 && wireType === 2) {
            update.departure = parseStopTimeEvent(reader.sub(reader.bytesField()));
        } else if (field === 4 && wireType === 2) {
            update.stopId = reader.string(reader.bytesField());
        } else if (field === 5 && wireType === 0) {
            update.skipped = reader.varint() === SCHEDULE_RELATIONSHIP_SKIPPED;
        } else {
            reader.skip(wireType);
        }
    }
    return update;
}

function parseTripUpdate(reader: Reader): GtfsTripUpdate {
    const update: GtfsTripUpdate = { tripId: '', cancelled: false, stopTimeUpdates: [] };
    while (!reader.done) {
        const { field, wireType } = reader.tag();
        if (field === 1 && wireType === 2) {
            const trip = reader.sub(reader.bytesField());
            while (!trip.done) {
                const tripTag = trip.tag();
                if (tripTag.field === 1 && tripTag.wireType === 2) {
                    update.tripId = trip.string(trip.bytesField());
                } else if (tripTag.field === 4 && tripTag.wireType === 0) {
                    update.cancelled = trip.varint() === SCHEDULE_RELATIONSHIP_CANCELED;
                } else {
                    trip.skip(tripTag.wireType);
                }
            }
        } else if (field === 2 && wireType === 2) {
            update.stopTimeUpdates.push(parseStopTimeUpdate(reader.sub(reader.bytesField())));
        } else {
            reader.skip(wireType);
        }
    }
    return update;
}

export function parseTripUpdates(buffer: ArrayBuffer | Uint8Array): GtfsTripUpdate[] {
    const reader = new Reader(buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer));
    const updates: GtfsTripUpdate[] = [];
    while (!reader.done) {
        const { field, wireType } = reader.tag();
        if (field === 2 && wireType === 2) {
            const entity = reader.sub(reader.bytesField());
            while (!entity.done) {
                const entityTag = entity.tag();
                if (entityTag.field === 3 && entityTag.wireType === 2) {
                    updates.push(parseTripUpdate(entity.sub(entity.bytesField())));
                } else {
                    entity.skip(entityTag.wireType);
                }
            }
        } else {
            reader.skip(wireType);
        }
    }
    return updates;
}
