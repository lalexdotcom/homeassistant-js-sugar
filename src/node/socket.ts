import { LG } from "big-l";
import {
  Auth,
  ConnectionOptions,
  HaWebSocket,
} from "home-assistant-js-websocket";
import WebSocket from "ws";

const LGR = LG.ns("node/socket");

const MSG_TYPE_AUTH_REQUIRED = "auth_required";
const MSG_TYPE_AUTH_INVALID = "auth_invalid";
const MSG_TYPE_AUTH_OK = "auth_ok";
const ERR_CANNOT_CONNECT = 1;
const ERR_INVALID_AUTH = 2;

const authMessage = (token: string) =>
  JSON.stringify({ type: "auth", access_token: token });

export type NodeSocketOptions = {
  retry: number;
  debug: boolean;
};

const defaultNodeSocketOptions: NodeSocketOptions = {
  retry: 3,
  debug: false,
};

export const createNodeSocket =
  (socketOptions: Partial<NodeSocketOptions> = {}) =>
  async (options: ConnectionOptions) => {
    const auth = options.auth!;
    const url = auth.wsUrl;

    const { debug, retry } = { ...defaultNodeSocketOptions, ...socketOptions };

    let isAuthInvalid = false;

    if (debug) LGR.debug("[AUTH] Init", url);

    const connect = (
      tries: number,
      promiseResolve: (socket: HaWebSocket) => void,
      promiseReject: (errorCode: number) => void
    ) => {
      const ws = new WebSocket(url, { rejectUnauthorized: false });
      let haVersion: string;

      const handleOpen = async (event: WebSocket.Event) => {
        try {
          if (auth.expired) {
            await auth.refreshAccessToken();
          }
          ws.send(authMessage(auth.accessToken));
        } catch (e) {
          isAuthInvalid = e === ERR_INVALID_AUTH;
          ws.close();
        }
      };

      const handleMessage = async ({
        data,
        type,
        target,
      }: WebSocket.MessageEvent) => {
        const message: { type: string; ha_version: string } = JSON.parse(
          data.toString()
        );
        haVersion ??= message.ha_version;

        switch (message.type) {
          case MSG_TYPE_AUTH_INVALID:
            isAuthInvalid = true;
            ws.close();

          case MSG_TYPE_AUTH_OK:
            if (debug)
              LGR.verb(
                "[AUTH] WebSocket connection to Home Assistant authenticated"
              );
            ws.removeEventListener("open", handleOpen);
            ws.removeEventListener("message", handleMessage);
            ws.removeEventListener("close", handleClose);
            ws.removeEventListener("error", handleError);
            const haws = ws as unknown as HaWebSocket;
            haws.haVersion = haVersion;
            promiseResolve(haws);
        }
      };

      const handleClose = async ({
        wasClean,
        code,
        reason,
        target,
      }: WebSocket.CloseEvent) => {
        let errorMessage: string | undefined;
        if (code && code !== 1000) {
          errorMessage = `WebSocket connection to Home Assistant closed with code ${code} and reason ${reason}`;
        }
        close(errorMessage);
      };

      const handleError = async ({
        error,
        message,
        type,
        target,
      }: WebSocket.ErrorEvent) => {
        ws.removeEventListener("close", handleClose);
        let errorMessage =
          "Disconnected from Home Assistant with a WebSocket error";
        if (message) errorMessage += ` with message: ${message}`;
        close(errorMessage);
      };

      const close = (errorMessage?: string) => {
        if (errorMessage) {
          LGR.error(
            `WebSocket Connection to HA close with message ${errorMessage}`
          );
        }
        if (isAuthInvalid) {
          promiseReject(ERR_INVALID_AUTH);
          return;
        }
        if (tries === 0) {
          promiseReject(ERR_CANNOT_CONNECT);
          return;
        }

        setTimeout(
          () =>
            connect(tries < -1 ? -1 : tries - 1, promiseResolve, promiseReject),
          1000
        );
      };

      const messageDebug = async ({
        data,
        type,
        target,
      }: WebSocket.MessageEvent) => {
        LGR.debug("[DEBUG]", type, JSON.parse(data.toString()));
      };

      ws.addEventListener("open", handleOpen);
      if (debug) ws.addEventListener("message", messageDebug);
      ws.addEventListener("message", handleMessage);
      ws.addEventListener("close", handleClose);
      ws.addEventListener("error", handleError);
    };

    return new Promise<HaWebSocket>((res, rej) => connect(retry, res, rej));
  };
