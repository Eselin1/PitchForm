import { useEffect, useRef, useState } from "react";
import { Clock } from "lucide-react";
import { notifyRestComplete } from "./timer-alerts";

type RestTimerProps = {
  label: string;
  seconds: number;
  alertsEnabled: boolean;
  onStart: () => void;
  onStop: () => void;
};

export function RestTimer({ label, seconds, alertsEnabled, onStart, onStop }: RestTimerProps) {
  const previousSeconds = useRef(seconds);
  const [justFinished, setJustFinished] = useState(false);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = String(seconds % 60).padStart(2, "0");

  useEffect(() => {
    if (previousSeconds.current > 0 && seconds === 0) {
      setJustFinished(true);
      if (alertsEnabled) notifyRestComplete();
    }
    if (seconds > 0) setJustFinished(false);
    previousSeconds.current = seconds;
  }, [seconds, alertsEnabled]);

  return (
    <div className={seconds > 0 ? "rest-timer active" : justFinished ? "rest-timer complete" : "rest-timer"}>
      <div><p className="eyebrow">Rest Timer</p><strong><Clock size={18} /> {minutes}:{remainingSeconds}</strong><span>{seconds > 0 ? label : justFinished ? "Rest complete. Next set is ready." : "Ready when you are"}</span></div>
      <button type="button" onClick={seconds > 0 ? onStop : onStart}>{seconds > 0 ? "Stop" : "Start"}</button>
    </div>
  );
}
