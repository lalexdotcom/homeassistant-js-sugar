import { Entity } from "../core/Entity";

export class BinarySensor extends Entity {
  state!: "on" | "off";
}
