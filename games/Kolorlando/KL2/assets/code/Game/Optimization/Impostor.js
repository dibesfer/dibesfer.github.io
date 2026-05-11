import BoxelAnalysis from "./BoxelAnalysis.js";

/*
  KL2 Impostor
  ------------
  Decides when a real far representation can be replaced by a cheaper visual proxy.

  It does not decide detail level. That belongs to LOD.js.
  It does not test occlusion. That belongs to OcclusionCulling.js.

  Future representations:
  - boxel-card
  - color-volume
  - billboard
*/

export class Impostor {
    static Mode = Object.freeze({
        NONE: "none",
        BILLBOARD: "billboard",
        BOXEL_CARD: "boxel-card",
        COLOR_VOLUME: "color-volume"
    });

    constructor({
        billboardDistance = 180,
        colorVolumeDistance = 260
    } = {}) {
        this.billboardDistance = billboardDistance;
        this.colorVolumeDistance = colorVolumeDistance;
    }

    modeForDistance(distance = 0) {
        const value = Math.max(0, Number(distance) || 0);

        if (value < this.billboardDistance) return Impostor.Mode.NONE;
        if (value < this.colorVolumeDistance) return Impostor.Mode.BOXEL_CARD;

        return Impostor.Mode.COLOR_VOLUME;
    }

    boxelPlan(boxel, distance = 0) {
        const mode = this.modeForDistance(distance);
        const voxelCount = BoxelAnalysis.voxelCount(boxel);

        return {
            mode,
            enabled: mode !== Impostor.Mode.NONE,
            boxel,
            visible: true,
            distance,
            dominantColor: BoxelAnalysis.dominantBoxelColor(boxel),
            bounds: BoxelAnalysis.bounds(boxel),
            voxelCount,
            hasShape: voxelCount > 0
        };
    }

    boxelPlanFromOrigin(boxel, origin = {}) {
        return this.boxelPlan(boxel, BoxelAnalysis.distanceFrom(boxel, origin));
    }
}

export default Impostor;

