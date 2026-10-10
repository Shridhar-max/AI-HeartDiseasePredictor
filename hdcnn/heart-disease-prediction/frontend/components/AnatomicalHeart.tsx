"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { Cross, ScanLine } from "lucide-react";
import Image from "next/image";

export function AnatomicalHeart() {
  const [hasAsset, setHasAsset] = useState(true);

  return (
    <motion.figure
      className="anatomical-heart"
      initial={{ opacity: 0, scale: 0.94, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.7, ease: "easeOut" }}
    >
      <div className="anatomical-heart__frame">
        {hasAsset ? (
          <Image
            src="/images/anatomical-heart.png"
            alt="Realistic anatomical human heart illustration"
            width={720}
            height={520}
            unoptimized
            onError={() => setHasAsset(false)}
          />
        ) : (
          <div className="anatomical-heart__fallback" role="img" aria-label="Anatomical human heart asset placeholder">
            <div className="fallback-plate__top"><span>ASSET SLOT / ANATOMICAL REFERENCE</span><ScanLine size={16} /></div>
            <div className="fallback-plate__diagram">
              <span className="vessel vessel--a" />
              <span className="vessel vessel--b" />
              <span className="organ-silhouette"><Cross size={22} /></span>
              <span className="callout callout--a">AORTA</span>
              <span className="callout callout--b">VENTRICULAR REGION</span>
              <span className="callout-line callout-line--a" />
              <span className="callout-line callout-line--b" />
            </div>
            <div className="fallback-plate__bottom">LOCAL IMAGE READY /images/anatomical-heart.png</div>
          </div>
        )}
        <span className="anatomical-heart__scan anatomical-heart__scan--one" />
        <span className="anatomical-heart__scan anatomical-heart__scan--two" />
      </div>
      <figcaption>Illustration slot / anatomical cardiovascular reference</figcaption>
    </motion.figure>
  );
}
