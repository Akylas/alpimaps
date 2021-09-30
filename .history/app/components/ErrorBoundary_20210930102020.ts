import ErrorComponent from './ErrorComponent.svelte';
export default class ErrorBoundary extends ErrorComponent {
    constructor(config) {
        console.log('test1')
        let error = null;
        config.props.$$slots.default = config.props.$$slots.default.map((x) => (...args) => {
            try {
                return x(...args);
            } catch (e) {
                console.log('error', e)
                error = e;
            }
        });
        super(config);
        if (error) {
            console.error('mounting error', error);
            this.$set({ error });
        }
    }
}
