<script lang="ts">
    // the speed sign: a white disc in a ring, one label. E-ink: the ring is black
    import { isEInk } from '~/helpers/theme';

    export let text: string;
    export let size: number;
    export let fontSize: number;
    export let ringColor: string;
</script>

<label
    backgroundColor="#ffffff"
    borderColor={isEInk ? '#000000' : ringColor}
    borderRadius={size / 2}
    borderWidth={3}
    color="#1b1c1d"
    {fontSize}
    fontWeight="bold"
    height={size}
    {text}
    textAlignment="center"
    verticalAlignment="middle"
    verticalTextAlignment="middle"
    width={size}
    {...$$restProps} />
