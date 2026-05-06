import { useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, Html } from '@react-three/drei'
import * as THREE from 'three'
// d3-force-3d ships without bundled types.
// @ts-expect-error — no published types
import { forceSimulation, forceLink, forceManyBody, forceCenter } from 'd3-force-3d'
import { X } from 'lucide-react'
import { useNoteStore } from './store'

interface SimNode {
  id: string
  title: string
  folderId: string | null
  color: string
  x?: number
  y?: number
  z?: number
  vx?: number
  vy?: number
  vz?: number
  fx?: number | null
  fy?: number | null
  fz?: number | null
}

interface SimEdge {
  source: SimNode | string
  target: SimNode | string
}

interface GraphViewProps {
  onClose: () => void
  onPickNote: (id: string) => void
}

const FOLDER_FALLBACK = '#6b7280'

/**
 * 3D knowledge-graph view: every non-archived note becomes a sphere,
 * every wikilink becomes an edge between the source note's sphere and
 * the matching target. Layout is driven by d3-force-3d (charge +
 * link distance + center). The canvas spins gently until the user
 * grabs an axis with the mouse / touch.
 */
export function GraphView({ onClose, onPickNote }: GraphViewProps) {
  const { notes, folders } = useNoteStore()

  // Build node list (active notes only) + edge list (resolved by title).
  const { nodes, edges } = useMemo(() => {
    const folderColor = (id: string | null) =>
      id ? folders.find((f) => f.id === id)?.color ?? FOLDER_FALLBACK : FOLDER_FALLBACK
    const active = notes.filter((n) => !n.isArchived)
    const titleToId = new Map(active.map((n) => [n.title.toLowerCase(), n.id]))
    const ns: SimNode[] = active.map((n) => ({
      id: n.id,
      title: n.title,
      folderId: n.folderId,
      color: folderColor(n.folderId),
    }))
    const es: SimEdge[] = []
    const wikilinkRe = /\[\[\s*([^\]\n]+?)\s*\]\]/g
    for (const n of active) {
      for (const m of n.content.matchAll(wikilinkRe)) {
        const target = titleToId.get(m[1].trim().toLowerCase())
        if (!target || target === n.id) continue
        es.push({ source: n.id, target })
      }
    }
    return { nodes: ns, edges: es }
  }, [notes, folders])

  // Build the simulation once for this set of nodes/edges.
  const sim = useMemo(() => {
    if (nodes.length === 0) return null
    const s = forceSimulation(nodes, 3)
      .force('link', forceLink(edges).id((d: SimNode) => d.id).distance(8).strength(0.6))
      .force('charge', forceManyBody().strength(-22))
      .force('center', forceCenter(0, 0, 0))
      .alpha(1)
      .alphaDecay(0.04)
      .stop()
    for (let i = 0; i < 80; i++) s.tick()
    return { tick: () => s.tick(), nodes, edges }
  }, [nodes, edges])

  const [hovered, setHovered] = useState<SimNode | null>(null)

  return (
    <div className="fixed inset-0 z-[80] bg-[var(--bg-primary)]">
      <header className="absolute top-0 inset-x-0 z-10 flex items-center justify-between px-4 py-3 border-b border-[var(--bg-tertiary)] bg-[var(--bg-secondary)]">
        <div>
          <h1 className="text-base font-display font-bold tracking-tight">Graph view</h1>
          <p className="text-xs text-[var(--text-tertiary)] mt-0.5">
            {nodes.length} notes · {edges.length} wikilinks · drag to rotate, scroll to zoom
          </p>
        </div>
        <button
          onClick={onClose}
          aria-label="Close graph"
          className="p-2 rounded-md text-[var(--text-tertiary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]"
        >
          <X className="w-5 h-5" />
        </button>
      </header>

      <Canvas camera={{ position: [0, 0, 28], fov: 55 }} className="w-full h-full">
        <color attach="background" args={['#0a0a0a']} />
        <ambientLight intensity={0.6} />
        <directionalLight position={[10, 10, 10]} intensity={0.8} />
        <Scene
          sim={sim}
          onPickNote={(id) => {
            onPickNote(id)
            onClose()
          }}
          hovered={hovered}
          setHovered={setHovered}
        />
        <OrbitControls
          enablePan
          enableZoom
          enableRotate
          rotateSpeed={0.8}
          zoomSpeed={0.9}
          dampingFactor={0.08}
        />
      </Canvas>

      {hovered && (
        <div className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-md bg-[var(--bg-secondary)] border border-[var(--bg-tertiary)] text-sm text-[var(--text-primary)] shadow-xl max-w-[80vw] truncate">
          {hovered.title}
        </div>
      )}
    </div>
  )
}

function Scene({
  sim,
  onPickNote,
  hovered,
  setHovered,
}: {
  sim: { tick: () => void; nodes: SimNode[]; edges: SimEdge[] } | null
  onPickNote: (id: string) => void
  hovered: SimNode | null
  setHovered: Dispatch<SetStateAction<SimNode | null>>
}) {
  const groupRef = useRef<THREE.Group>(null)
  const linesRef = useRef<THREE.LineSegments>(null)
  const { gl } = useThree()

  // Cursor while hovering a node — direct DOM write into the
  // R3F-managed canvas element.
  useEffect(() => {
    const el = gl.domElement
    /* eslint-disable react-hooks/immutability */
    el.style.cursor = hovered ? 'pointer' : 'grab'
    return () => {
      el.style.cursor = ''
    }
    /* eslint-enable react-hooks/immutability */
  }, [hovered, gl])

  const positions = useMemo(
    () => (sim ? new Float32Array(sim.edges.length * 6) : new Float32Array(0)),
    [sim],
  )

  useFrame(() => {
    if (!sim) return
    sim.tick()

    const group = groupRef.current
    if (group) {
      sim.nodes.forEach((n, idx) => {
        const mesh = group.children[idx] as THREE.Mesh | undefined
        if (mesh && n.x != null && n.y != null && n.z != null) {
          mesh.position.set(n.x, n.y, n.z)
        }
      })
    }

    const lines = linesRef.current
    if (lines && positions.length > 0) {
      sim.edges.forEach((e, i) => {
        const s = e.source as SimNode
        const t = e.target as SimNode
        if (s.x == null || t.x == null) return
        const o = i * 6
        positions[o + 0] = s.x
        positions[o + 1] = s.y!
        positions[o + 2] = s.z!
        positions[o + 3] = t.x
        positions[o + 4] = t.y!
        positions[o + 5] = t.z!
      })
      const attr = lines.geometry.attributes.position as THREE.BufferAttribute | undefined
      if (attr) attr.needsUpdate = true
      lines.geometry.computeBoundingSphere()
    }
  })

  if (!sim) {
    return (
      <Html center>
        <div className="text-[var(--text-tertiary)] text-sm">No notes to graph yet.</div>
      </Html>
    )
  }

  return (
    <>
      <group ref={groupRef}>
        {sim.nodes.map((n) => (
          <mesh
            key={n.id}
            onPointerOver={(e) => {
              e.stopPropagation()
              setHovered(n)
            }}
            onPointerOut={() => setHovered((h) => (h?.id === n.id ? null : h))}
            onClick={(e) => {
              e.stopPropagation()
              onPickNote(n.id)
            }}
          >
            <sphereGeometry args={[hovered?.id === n.id ? 0.55 : 0.4, 16, 16]} />
            <meshStandardMaterial color={n.color} emissive={n.color} emissiveIntensity={0.25} />
          </mesh>
        ))}
      </group>

      {sim.edges.length > 0 && (
        <lineSegments ref={linesRef}>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              args={[positions, 3]}
              count={sim.edges.length * 2}
            />
          </bufferGeometry>
          <lineBasicMaterial color="#475569" transparent opacity={0.45} />
        </lineSegments>
      )}
    </>
  )
}
