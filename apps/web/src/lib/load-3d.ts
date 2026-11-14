export type Load3dInput = {
	visible: boolean;
	idle: boolean;
	webgl: boolean;
	reducedMotion: boolean;
	saveData: boolean;
	slowNetwork: boolean;
};
export const shouldLoad3d = (i: Load3dInput) =>
	i.visible &&
	i.idle &&
	i.webgl &&
	!i.reducedMotion &&
	!i.saveData &&
	!i.slowNetwork;
export const isSlowNetwork = (type: string | undefined) =>
	type === "2g" || type === "slow-2g";
