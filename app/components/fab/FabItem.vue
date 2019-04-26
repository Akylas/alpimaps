<template>
	<StackLayout class="fab-item" :backgroundColor="color">
		<Label :text="title" horizontalAlignment="center" />
	</StackLayout>
</template>

<script>
	export default {
	props: { title: String, color: String }
}

</script>

<style scoped>
	.fab-item {
		width: 40;
		height: 40;
		border-radius: 20;
		color: #fff;
		font-weight: bold;
		vertical-align: center;
	}
</style>