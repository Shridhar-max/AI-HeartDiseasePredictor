"use client";

import { motion } from "motion/react";
import { Activity, BrainCircuit } from "lucide-react";

export function AnimatedSignal() {
  return (
    <div className="signal-panel" aria-label="Animated model signal visualization">
      <div className="signal-panel__header">
        <span className="signal-panel__label">
          <span className="signal-dot" />
          Model signal monitor
        </span>
        <span className="signal-panel__code">CNN / 1D</span>
      </div>

      <div className="signal-panel__canvas">
        <div className="signal-grid" />
        <motion.div
          className="signal-orbit signal-orbit--outer"
          animate={{ rotate: 360 }}
          transition={{ duration: 26, repeat: Infinity, ease: "linear" }}
        />
        <motion.div
          className="signal-orbit signal-orbit--inner"
          animate={{ rotate: -360 }}
          transition={{ duration: 18, repeat: Infinity, ease: "linear" }}
        />
        <motion.div
          className="signal-core"
          animate={{ scale: [1, 1.05, 1], opacity: [0.82, 1, 0.82] }}
          transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
        >
          <Activity size={34} strokeWidth={1.5} />
        </motion.div>
        <div className="signal-node signal-node--one"><BrainCircuit size={17} /></div>
        <div className="signal-node signal-node--two"><Activity size={17} /></div>
        <div className="signal-node signal-node--three" />
      </div>

      <div className="signal-panel__footer">
        <span>15 components</span>
        <span className="signal-panel__status">Ready for input</span>
      </div>
    </div>
  );
}
