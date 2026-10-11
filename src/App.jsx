import { useEffect, useRef, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { createEngine } from './game/Engine.js';
import { store, useGame } from './store/gameStore.js';
import LoadingScreen from './components/LoadingScreen.jsx';
import TitleScreen from './components/TitleScreen.jsx';
import MissionSelect from './components/MissionSelect.jsx';
import PilotSelect from './components/PilotSelect.jsx';
import Hangar from './components/Hangar.jsx';
import BriefingScreen from './components/BriefingScreen.jsx';
import HUD from './components/HUD.jsx';
import Minimap from './components/Minimap.jsx';
import Banner from './components/Banner.jsx';
import BossIntro from './components/BossIntro.jsx';
import ScorePopups from './components/ScorePopups.jsx';
import DamageFlash from './components/DamageFlash.jsx';
import Reticle from './components/Reticle.jsx';
import TouchControls from './components/TouchControls.jsx';
import PauseMenu from './components/PauseMenu.jsx';
import Debrief from './components/Debrief.jsx';
import GameOver from './components/GameOver.jsx';

const MIN_LOADING_MS = 2600; // long enough for the boot animation to read, even on fast machines

export default function App() {
  const canvasRef = useRef(null);
  const engineRef = useRef(null);
  const [minTimeDone, setMinTimeDone] = useState(false);
  const phase = useGame((s) => s.phase);
  const loadDone = useGame((s) => s.load.done);
  const touch = useGame((s) => s.touch);
  const minimap = useGame((s) => s.minimap);

  useEffect(() => {
    const engine = createEngine(canvasRef.current);
    engineRef.current = engine;
    engine.load().catch((err) => {
      console.error(err);
      store.set((s) => ({ load: { ...s.load, error: 'This device could not start WebGL. Try a recent Chrome, Edge, Firefox or Safari with hardware acceleration on.' } }));
    });
    const t = setTimeout(() => setMinTimeDone(true), MIN_LOADING_MS);
    return () => { clearTimeout(t); engine.dispose(); };
  }, []);

  useEffect(() => {
    if (phase === 'loading' && loadDone && minTimeDone) store.set({ phase: 'title' });
  }, [phase, loadDone, minTimeDone]);

  const engine = engineRef.current;
  const inRun = phase === 'playing' || phase === 'paused';

  return (
    <div className="app">
      <canvas ref={canvasRef} className={`stage ${phase === 'playing' && !touch ? 'no-cursor' : ''}`} aria-label="IRONWALK game view" />

      {inRun && engine && <HUD engine={engine} />}
      <AnimatePresence>{inRun && minimap && engine && <Minimap key="minimap" engine={engine} />}</AnimatePresence>
      {phase === 'playing' && !touch && <Reticle />}
      {phase === 'playing' && touch && engine && <TouchControls input={engine.input} />}
      {(inRun || phase === 'over' || phase === 'debrief') && <Banner />}
      {inRun && <BossIntro />}
      <ScorePopups />
      <DamageFlash />

      <AnimatePresence mode="wait">
        {phase === 'loading' && <LoadingScreen key="loading" />}
        {phase === 'title' && engine && <TitleScreen key="title" engine={engine} />}
        {phase === 'missions' && engine && <MissionSelect key="missions" engine={engine} />}
        {phase === 'pilot' && engine && <PilotSelect key="pilot" engine={engine} />}
        {phase === 'hangar' && engine && <Hangar key="hangar" engine={engine} />}
        {phase === 'briefing' && engine && <BriefingScreen key="briefing" engine={engine} />}
        {phase === 'paused' && engine && <PauseMenu key="paused" engine={engine} />}
        {phase === 'debrief' && engine && <Debrief key="debrief" engine={engine} />}
        {phase === 'over' && engine && <GameOver key="over" engine={engine} />}
      </AnimatePresence>
    </div>
  );
}
