import ErrorComponent from './ErrorComponent.svelte';
export default class ErrorBoundary extends ErrorComponent {
    constructor(config) {
        let error = null;
        config.props.$$slots.default = config.props.$$slots.default.map((x) => (...args) => {
            try {
                console.log('test')
                return x(...args);
            } catch (e) {
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
