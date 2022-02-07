import { LG } from "big-l";
import { Logger } from "big-l/lib/debug/Logger";
import {
  Auth,
  callService,
  Connection as HAConnection,
  createConnection,
  createLongLivedTokenAuth,
  getStates,
  HassEntity,
  HassEvent,
  StateChangedEvent,
} from "home-assistant-js-websocket";
import { Entity, EntityDomain } from "./Entity";
import { createNodeSocket } from "../node/socket";
import { BinarySensor } from "../entities/BinarySensor";
import { Switch } from "../entities/Switch";
import { Light } from "../entities/Light";
import { Sensor } from "../entities/Sensor";
import { Fan } from "../entities/Fan";

const LGR = LG.ns("sugar/connections");

type EntityClass = {
  new (conn: Connection, props: HassEntity): Entity;
};

const entityDomainRegistry: { [key in EntityDomain]: EntityClass } = {
  binary_sensor: BinarySensor,
  switch: Switch,
  light: Light,
  sensor: Sensor,
  fan: Fan,
};

export class Connection {
  static async connect(url: string, logLiveToken: string) {
    const haConnection = await createConnection({
      auth: createLongLivedTokenAuth(url, logLiveToken),
      createSocket: createNodeSocket(),
    });
    const connection = new Connection(haConnection);
    await connection.init();
    return connection;
  }

  #ha: HAConnection;
  #entities: Record<string, Entity> = {};
  #usedIds: Set<string> = new Set();

  private constructor(ha: HAConnection) {
    this.#ha = ha;
  }

  protected async init() {
    const states = await getStates(this.#ha);
    for (const st of states) {
      const entityClass =
        entityDomainRegistry[st.entity_id.split(".").shift()! as EntityDomain];
      if (entityClass) {
        const entity = new entityClass(this, st);
        if (entity) this.#entities[st.entity_id] = entity;
      }
    }
    await this.#ha.subscribeEvents(
      (e) => this.#handleStateEvents(e as StateChangedEvent),
      "state_changed"
    );
  }

  #handleStateEvents(e: StateChangedEvent) {
    if (!this.#usedIds.has(e.data.entity_id)) return;
    if (e.data.new_state) {
      this.getEntity(e.data.entity_id)?.fill(e.data.new_state);
    }
  }

  getEntity<ENTITY_CLASS extends Entity = Entity>(
    entityId: string
  ): ENTITY_CLASS | undefined {
    const entity = this.#entities[entityId] as ENTITY_CLASS;
    if (entity) this.#usedIds.add(entity.id);
    return entity;
  }

  async callService(
    domain: EntityDomain | string,
    service: string,
    serviceData?: any,
    target?: any
  ) {
    return callService(this.#ha, domain, service, serviceData, target);
  }
}
