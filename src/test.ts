import { LG } from "big-l";
import { Connection } from "./core/Connection";
import { Fan } from "./entities/Fan";
import { Light } from "./entities/Light";
import { Sensor } from "./entities/Sensor";
import { Switch } from "./entities/Switch";

const scriptName = "test-ha-js-sugar";
const LGR = LG.ns(scriptName);

const ACCESS_TOKEN =
  "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiI3MjI1MDM4NDZjNzI0MzFmODYwNmI0ZTViNWYxMTVjNyIsImlhdCI6MTY0NDQyNTk5NywiZXhwIjoxOTU5Nzg1OTk3fQ.QBliLICX80o98AUADQBQU2I2mzhjxX1XkDDytabxkPk";

(async function () {
  try {
    for (const evt of [
      "beforeExit",
      "uncaughtException",
      "SIGTSTP",
      "SIGQUIT",
      "SIGHUP",
      "SIBABRT",
      "SIGTERM",
      "SIGINT",
    ]) {
      process.on(evt, async () => {
        LGR.crit(`!! ${scriptName} interrupted by ${evt} !!`);
        process.exit(1);
      });
    }

    LGR.notice(`:: START ${scriptName} ::`);

    const conn = await Connection.connect(
      "http://127.0.0.1:8123",
      ACCESS_TOKEN
    );

    const lgt = conn.getEntity<Light>("light.virtual_light_1");
    const sw = conn.getEntity<Switch>("switch.virtual_switch_1");
    const hacs = conn.getEntity<Sensor>("sensor.hacs");
    const fan = conn.getEntity<Fan>("fan.virtual_office_fan");
    const tog = conn.getEntity<Switch>("input_boolean.toggle");
    const tog2 = conn.getEntity<Switch>("input_boolean.toggle2");
    if (sw) LGR.debug(sw.domain, "=>", sw.id);
    LGR.debug("HACS:", hacs?.toHumanString());
    tog?.addStateListener(
      async (lgt: Switch, oldState) => {
        await tog2?.setState(lgt.state);
        await fan?.setState(lgt.state);
      },
      { oldState: true }
    );

    LGR.notice(`-- ${scriptName} DONE --`);
    // process.exit();
  } catch (e) {
    LGR.crit(`!! ${scriptName} ERROR ${(e as Error)?.message || e} !!`);
    process.exit(1);
  }
})();
