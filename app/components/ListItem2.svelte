<script context="module" lang="ts">
    import { createNativeAttributedString } from '@nativescript-community/text';
    import { Align, Canvas, CanvasView, LayoutAlignment, Paint, StaticLayout } from '@nativescript-community/ui-canvas';
    import dayjs from 'dayjs';
    import { NativeViewElementNode } from 'svelte-native/dom';
    import SimpleOpeningHours from '~/helpers/SimpleOpeningHours';
    import { lc } from '~/helpers/locale';
    import { backgroundColor, subtitleColor as defaultSubtitleColor, mdiFontFamily, primaryColor, textColor } from '~/variables';
    const sectionsMatch = { su: 'sunday', mo: 'monday', tu: 'tuesday', we: 'wednesday', th: 'thursday', fr: 'friday', sa: 'saturday' };
    const textPaint: Paint = new Paint();
    textPaint.textSize = 16;
    const iconPaint = new Paint();
    iconPaint.textSize = 24;
    iconPaint.fontFamily = mdiFontFamily;
    iconPaint.setTextAlign(Align.CENTER);
</script>

<script lang="ts">
    export let height: string | number = '100%';
    export let smallHeight: number = 70;
    export let title: string = null;
    export let subtitle: string = null;
    export let leftIcon: string = null;
    export let subtitleColor = null;
    export let titleColor = null;
    // export let id = null;
    // export let rightIcon = null;
    export let opening_hours: SimpleOpeningHours = null;
    // export let expandable = false;
    export let expanded = false;

    let canvas: NativeViewElementNode<CanvasView>;
    // console.log('test', title, subtitle, leftIcon);
    let nString;
    const padding = 16;
    function onDraw({ canvas, object }: { canvas: Canvas; object: CanvasView }) {
        try {
            const w = canvas.getWidth();
            const h = canvas.getHeight();
            textPaint.setFontWeight('normal');
            const smallH = smallHeight;
            let leftPadding = padding;
            const rightPadding = padding;
            if (leftIcon) {
                leftPadding += 40;
                iconPaint.color = $textColor;
                canvas.drawText(leftIcon, 30, smallH / 2 + 10, iconPaint);
            }
            if (!nString) {
                const spans = (
                    title
                        ? [
                              {
                                  fontSize: 13,
                                  text: title,
                                  color: titleColor || $defaultSubtitleColor
                              }
                          ]
                        : ([] as any[])
                ).concat(
                    subtitle
                        ? [
                              {
                                  text: (title ? '\n' : '') + subtitle,
                                  color: subtitleColor || $textColor
                              }
                          ]
                        : []
                );
                nString = createNativeAttributedString({
                    spans
                });
                // console.log('spans', spans);
            }
            textPaint.setTextAlign(Align.LEFT);
            textPaint.color = $textColor;
            textPaint.textSize = 16;
            // console.log('onDraw', title, subtitle, leftIcon, nString);
            const staticLayout = new StaticLayout(nString, textPaint, w - leftPadding - rightPadding, LayoutAlignment.ALIGN_NORMAL, 1, 0, true);
            const layoutHeight = staticLayout.getHeight();
            canvas.save();
            canvas.translate(leftPadding, smallH / 2 - layoutHeight / 2);
            staticLayout.draw(canvas);
            canvas.restore();

            if (opening_hours && expanded) {
                const data = opening_hours.openingHours;
                if (typeof data === 'object') {
                    let dy = 80;
                    textPaint.color = $textColor;
                    let array;
                    const date = dayjs();
                    Object.keys(sectionsMatch).forEach((k, index) => {
                        if (k === 'ph' || k === 'sh') {
                            return;
                        }
                        if (index === date.day()) {
                            textPaint.setFontWeight('bold');
                        } else {
                            textPaint.setFontWeight('normal');
                        }
                        textPaint.textSize = 14;
                        textPaint.setTextAlign(Align.LEFT);
                        canvas.drawText(sectionsMatch[k], padding, dy, textPaint);
                        textPaint.setTextAlign(Align.RIGHT);
                        canvas.drawText(
                            data[k]?.length
                                ? data[k]
                                      .map((s) =>
                                          s
                                              .split('-')
                                              .map((s2) => {
                                                  array = s2.split(':').map((d) => parseInt(d, 10)) as [number, number];
                                                  return date.set('h', array[0]).set('m', array[1]).format('LT');
                                              })
                                              .join(' - ')
                                      )
                                      .join(',')
                                : lc('closed'),
                            w - padding,
                            dy,
                            textPaint
                        );
                        dy += 22;
                    });
                }
            }
        } catch (err) {
            console.error(err, err.stack);
        }
    }

    function redraw(...args) {
        nString = null;
        canvas?.nativeView?.redraw();
    }
    $: redraw(title, subtitle, leftIcon);
</script>

<canvas bind:this={canvas} backgroundColor={$backgroundColor} {height} rippleColor={primaryColor}>
    <!-- <canvaslabel padding={16}>
        <cgroup c="middle" paddingBottom={subtitle ? 10 : 0}>
            <cspan visibility={leftIcon ? 'visible' : 'hidden'} paddingLeft={10} width={40} text={leftIcon} fontFamily={leftIconFonFamily} fontSize={24} />
        </cgroup>
        <cgroup paddingLeft={(leftIcon ? 40 : 0) + extraPaddingLeft} verticalAlignment="middle" textAlignment="left">
            <cspan text={title} fontWeight="bold" fontSize={16} />
            <cspan text={subtitle ? '\n' + subtitle : ''} color={$subtitleColor} fontSize={13} />
        </cgroup>
        <line visibility={showBottomLine ? 'visible' : 'hidden'} height={1} color={$borderColor} strokeWidth={1} startX={0} verticalAlignment="bottom" startY={0} stopX="100%" stopY={0} />
    </canvaslabel> -->
</canvas>
