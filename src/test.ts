import { LG } from "big-l";
import { Connection } from "./core/Connection";
import { Fan } from "./entities/Fan";
import { Light } from "./entities/Light";
import { Sensor } from "./entities/Sensor";
import { Switch } from "./entities/Switch";

const scriptName = "test-ha-js-sugar";
const LGR = LG.ns(scriptName);

const ACCESS_TOKEN =
  "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiI0NjYzNjk5ODE1OTA0NWJmOWQ3ODIwZmVlYWZlYTBmMSIsImlhdCI6MTY0NDIyODczOSwiZXhwIjoxOTU5NTg4NzM5fQ.hQyJ2foXHMYfE82YQ4ogT-V6V8kS0GmAIF2w8AlH_Yk";

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
    if (sw) LGR.debug(sw.domain, "=>", sw.id);
    LGR.debug("HACS:", hacs?.toHumanString());
    if (lgt) {
      lgt.addStateListener(
        async (lgt: Light, oldState) => {
          LGR.debug("Got light change", lgt.state, lgt.attributes);
          await sw?.setState(lgt.state);
          await fan?.setState(lgt.state);
        },
        { oldState: true, onlyIfStateChange: false }
      );
    }

    LGR.notice(`-- ${scriptName} DONE --`);
    // process.exit();
  } catch (e) {
    LGR.crit(`!! ${scriptName} ERROR ${(e as Error).message || ""} !!`);
    process.exit(1);
  }
})();
