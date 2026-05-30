import { createRoot } from 'react-dom/client'
import { useGLTF, useTexture } from '@react-three/drei'
import 'inter-ui'
import './styles.css'
import { App } from './App'

useTexture.preload(`${import.meta.env.BASE_URL}textures/heightmap_1024.png`)
useGLTF.preload(`${import.meta.env.BASE_URL}models/track-draco.glb`)
useGLTF.preload(`${import.meta.env.BASE_URL}models/chassis-draco.glb`)
useGLTF.preload(`${import.meta.env.BASE_URL}models/wheel-draco.glb`)

createRoot(document.getElementById('root')!).render(<App />)
