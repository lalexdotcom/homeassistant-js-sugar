import { BinarySensor } from "./BinarySensor";

export class Switch extends BinarySensor {
  toggle() {
    return this.callService("toggle");
  }

  turnOn() {
    return this.callService("turn_on");
  }

  turnOff() {
    return this.callService("turn_off");
  }

  setState(state: Switch["state"]) {
    return state === "on" ? this.turnOn() : this.turnOff();
  }
}
