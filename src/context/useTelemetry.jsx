import { useContext } from "react";
import TelemetryContext from "./TelemetryContext";

export default function useTelemetry() {
  return useContext(TelemetryContext);
}
