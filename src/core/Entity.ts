import { LG } from "big-l";
import { HassEntity } from "home-assistant-js-websocket";
import { Connection } from "./Connection";
import { parseJSON } from "date-fns";
import { BinarySensor } from "../entities/BinarySensor";
import { Switch } from "../entities/Switch";
import { Light } from "../entities/Light";

const LGR = LG.ns("sugar/entity");

export enum EntityDomain {
  BINARY_SENSOR = "binary_sensor",
  SWITCH = "switch",
  LIGHT = "light",
  SENSOR = "sensor",
  FAN = "fan",
}

type EntityStateListenerOptions = {
  onlyIfStateChange?: boolean;
  oldState?: boolean;
};

type EntityStateListener<T extends Entity> = (
  entity: T,
  oldState?: T["state"]
) => void;

export abstract class Entity {
  readonly domain: EntityDomain;
  #connection: Connection;
  #listeners: Map<Function, EntityStateListenerOptions> = new Map();
  private entityState!: HassEntity;

  id!: string;
  abstract state: HassEntity["state"];
  lastChanged!: string;
  lastUpdated!: string;
  attributes!: HassEntity["attributes"];
  context!: { id: string; user_id: string };

  constructor(conn: Connection, props: HassEntity) {
    this.#connection = conn;
    this.domain = props.entity_id.split(".").shift()! as EntityDomain;
    this.fill(props);

    LG.limit("", 2).debug("Create entity", props);
  }

  fill(props: HassEntity) {
    LGR.debug("Fill", props.entity_id);
    const oldState = this.entityState;
    Object.assign(this, { ...this.parse(props), entityState: props });
    for (const [listener, params] of this.#listeners.entries())
      if (oldState.state !== props.state || !params.onlyIfStateChange) {
        listener(
          this,
          params.oldState ? this.parse(oldState).state : undefined
        );
      }
  }

  parse({
    entity_id,
    state,
    last_changed,
    last_updated,
    attributes,
    context,
  }: HassEntity) {
    return {
      id: entity_id,
      state: this.parseState(state),
      lastChanged: parseJSON(last_changed),
      lastUpdated: parseJSON(last_updated),
      attributes: this.parseAttributes(attributes),
      context,
    };
  }

  parseState(state: string) {
    return state;
  }

  parseAttributes(attributes: Record<string, unknown>) {
    return { ...attributes };
  }

  async callService(service: string, serviceData?: any) {
    return this.#connection.callService(this.domain, service, serviceData, {
      entity_id: this.id,
    });
  }

  async addStateListener<T extends Entity>(
    callback: EntityStateListener<T>,
    options?: EntityStateListenerOptions
  ) {
    this.#listeners.set(callback, { onlyIfStateChange: true, ...options });
  }

  toHumanString() {
    return this.state + " " + this.attributes.unit_of_measurement;
  }
}
