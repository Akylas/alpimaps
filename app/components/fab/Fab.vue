<template>
<StackLayout left="0" top="0" height="100%" width="100%" class="backdrop" :class="classBackdrop" />
	<AbsoluteLayout ref="fabItemPosition" marginTop="87%" marginLeft="80%">
				<GridLayout ref="fabItemContainer" left="8" top="8">
          <slot/>
					<!-- <FabItem row="1" :class="classItem1" color="#E94E77" title="E" />
					<FabItem row="1" :class="classItem2" color="#3FB8AF" title="U" />
					<FabItem row="1" :class="classItem3" color="#FCB653" title="V" /> -->
				</GridLayout>
				<StackLayout class="fab-button" @tap="$emit('onButtonTap')" @touch="onButtonTouch">
		<GridLayout rows="2, auto" horizontalAlignment="center" class="fab-icon" :class="buttonAnimation">
			<Label row="1" class="fab-dash--1" />
			<Label row="1" class="fab-dash--2" />
		</GridLayout>
	</StackLayout>
			</AbsoluteLayout>
</template>


<script>
	export default {
    props: {
        isActive: Boolean
    },
    computed: {
        buttonAnimation() {
            return this.isActive ? "iconActive" : "iconIdle"
        }
    },    
    methods: {
        onButtonTouch(args) {
		    this.$emit('onButtonTouch', args)
        }
    }
}

</script>

<style scoped>
	.fab-button {
		width: 56;
		height: 56;
		background-color: orangered;
		border-radius: 28;
		vertical-align: center;
	}

	.fab-icon {
		height: 16;
		width: 16;
	}

	.fab-dash--1,
	.fab-dash--2 {
		background-color: #fff;
		transform: translate(0, -2);
		height: 16;
		width: 3;
	}

	.fab-dash--1 {
		transform: rotate(90deg) translate(0, -2);
	}

	.iconActive {
		animation-name: iconActive;
		animation-duration: .25;
		animation-timing-function: cubic-bezier(0.165, 0.840, 0.440, 1.000);
		animation-fill-mode: forwards;
	}

	.iconIdle {
		animation-name: iconActive;
		animation-duration: .25;
		animation-timing-function: ease-out;
		animation-fill-mode: forwards;
		animation-direction: reverse;
	}

	@keyframes iconActive {
		from {
			transform: rotate(0deg);
		}
		to {
			transform: rotate(225deg);
		}
  }
  .backdrop {
		background-color: rgba(29, 30, 35, .90);
		opacity: 0;
	}

	.backdrop-visible {
		animation-name: activateBackdrop;
		animation-duration: .25;
		animation-fill-mode: forwards;
	}

	.backdrop-invisible {
		animation-name: activateBackdrop;
		animation-duration: .25;
		animation-fill-mode: forwards;
		animation-direction: reverse;
	}

	.raiseItem1 {
		opacity: 1;
		animation-name: raiseItem1;
		animation-duration: .25;
		animation-timing-function: cubic-bezier(0.165, 0.840, 0.440, 1.000);
		animation-fill-mode: forwards;
	}

	.raiseItem2 {
		opacity: 1;
		animation-name: raiseItem2;
		animation-duration: .25;
		animation-timing-function: cubic-bezier(0.165, 0.840, 0.440, 1.000);
		animation-fill-mode: forwards;
	}

	.raiseItem3 {
		opacity: 1;
		animation-name: raiseItem3;
		animation-duration: .25;
		animation-timing-function: cubic-bezier(0.165, 0.840, 0.440, 1.000);
		animation-fill-mode: forwards;
	}

	.downItem1 {
		animation-name: raiseItem1;
		animation-duration: .20;
		animation-timing-function: cubic-bezier(0.895, 0.030, 0.685, 0.220);
		animation-fill-mode: forwards;
		animation-direction: reverse;
	}

	.downItem2 {
		animation-name: raiseItem2;
		animation-duration: .20;
		animation-timing-function: cubic-bezier(0.895, 0.030, 0.685, 0.220);
		animation-fill-mode: forwards;
		animation-direction: reverse;
	}

	.downItem3 {
		animation-name: raiseItem3;
		animation-duration: .20;
		animation-timing-function: cubic-bezier(0.895, 0.030, 0.685, 0.220);
		animation-fill-mode: forwards;
		animation-direction: reverse;
	}

	@keyframes activateBackdrop {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}

	@keyframes raiseItem1 {
		from {
			opacity: 1;
			transform: translate(0, 0);
		}
		to {
			opacity: 1;
			transform: translate(0, -64);
		}
	}

	@keyframes raiseItem2 {
		from {
			opacity: 1;
			transform: translate(0, 0);
		}
		to {
			opacity: 1;
			transform: translate(0, -128);
		}
	}

	@keyframes raiseItem3 {
		from {
			opacity: 1;
			transform: translate(0, 0);
		}
		to {
			opacity: 1;
			transform: translate(0, -192);
		}
	}
</style>