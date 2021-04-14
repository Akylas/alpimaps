require('globals');
const context: Worker = self as any;

context.onmessage = ((event: { data: any }) => {
    console.log('parseimage', event.data);
    context.postMessage({ data:event.data });
}) as any;
