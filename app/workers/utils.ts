import { WorkerEventType } from './BaseWorker';

export function prepareWorker(worker) {
    const messagePromises: { [key: string]: { resolve: Function; reject: Function; timeoutTimer: number }[] } = {};
    worker.onmessage = function onWorkerMessage(event: {
        data: {
            type: WorkerEventType;
            error?;
            // result: WorkerResult;
            messageData;
            id?: number;
            nativeDataKeys: string[];
            nativeDatas?: { [k: string]: any };
        };
    }) {
        const data = event.data;
        const messageData = data.messageData;
        if (typeof messageData === 'string') {
            try {
                data.messageData = JSON.parse(messageData);
            } catch (error) {}
        }
        const id = data.id;

        if (id && messagePromises.hasOwnProperty(id)) {
            messagePromises[id].forEach(function (executor) {
                executor.timeoutTimer && clearTimeout(executor.timeoutTimer);
                // if (isError) {
                // executor.reject(createErrorFromMessage(message));
                // } else {
                const id = data.id;
                if (data.nativeDataKeys?.length > 0) {
                    const nativeDatas: { [k: string]: any } = {};
                    if (__ANDROID__) {
                        data.nativeDataKeys.forEach((k) => {
                            nativeDatas[k] = akylas.alpi.maps.WorkersContext.getValue(`${id}_${k}`);
                            akylas.alpi.maps.WorkersContext.setValue(`${id}_${k}`, null);
                        });
                        data.nativeDatas = nativeDatas;
                    }
                }
                if (data.error) {
                    executor.reject(JSON.parse(data.error));
                } else {
                    executor.resolve(data);
                }
                // }
            });
            delete messagePromises[id];
        }
    };
    worker.sendMessageToWorker = function <T = any>(type: string, messageData?, id?: number, error?, timeout = 0): Promise<T> {
        return new Promise((resolve, reject) => {
            // const id = Date.now().valueOf();
            if (id || timeout) {
                messagePromises[id] = messagePromises[id] || [];
                let timeoutTimer;
                if (timeout > 0) {
                    timeoutTimer = setTimeout(() => {
                        // we need to try catch because the simple fact of creating a new Error actually throws.
                        // so we will get an uncaughtException
                        try {
                            reject(new Error('timeout'));
                        } catch {}
                        delete messagePromises[id];
                    }, timeout);
                }
                messagePromises[id].push({ reject, resolve, timeoutTimer });
            }

            // const result = worker.processImage(image, { width, height, rotation });
            // handleContours(result.contours, rotation, width, height);
            // const keys = Object.keys(nativeData);
            // if (__ANDROID__) {
            //     keys.forEach((k) => {
            //         akylas.alpi.maps.WorkersContext.setValue(`${id}_${k}`, nativeData[k]._native || nativeData[k]);
            //     });
            // }
            const data = {
                error: error !== undefined ? JSON.stringify({ message: error.toString(), stack: error.stack }) : undefined,
                id,
                messageData: messageData !== undefined ? JSON.stringify(messageData) : undefined,
                // nativeDataKeys: keys,
                type
            };
            worker.postMessage(data);
        });
    };
    return worker as Worker & {
        sendMessageToWorker<T = any>(type: string, messageData?, id?: number, error?, timeout?): Promise<T>;
    };
}
