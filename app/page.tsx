"use client";

import { useState, useEffect } from "react";
import Game from "./components/game";
import { MobileConnect } from "./components/mobileJoinGame";
export default function HomePage() {
  return (
    <MobileConnect></MobileConnect>
  );
}