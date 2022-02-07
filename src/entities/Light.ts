import { Switch } from "./Switch";

type LightParams = {};

export class Light extends Switch {
  toggle(data?: LightParams) {
    return this.callService("toggle", data);
  }

  turnOn(data?: LightParams) {
    return this.callService("turn_on", data);
  }

  setState(state: Light["state"], data?: LightParams) {
    return state === "on" ? this.turnOn(data) : this.turnOff();
  }
}
