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
  /** Source content length in characters (post-strip would be nicer but
   *  is overkill for sphere sizing). */
  contentSize: number
  /** inbound + outbound wikilinks. */
  degree: number
  /** Pre-computed sphere radius derived from content + degree. */
  radius: number
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
  /** 1 + duplicate-link weight, used for line opacity / link strength. */
  weight: number
}

interface GraphViewProps {
  onClose: () => void
  onPickNote: (id: string) => void
}

const FOLDER_FALLBACK = '#6b7280'
const MIN_RADIUS = 0.55
const MAX_RADIUS = 2.8
const LABEL_MAX_CHARS = 22

/** Map (contentSize, degree) → sphere radius, capped on both ends so a
 *  giant note can't dwarf the rest of the graph. */
function nodeRadius(contentSize: number, degree: number): number {
  const tokenScore = Math.log10(1 + contentSize / 200) * 0.5
  const degreeScore = Math.sqrt(degree) * 0.55
  return Math.max(MIN_RADIUS, Math.min(MAX_RADIUS, MIN_RADIUS + tokenScore + degreeScore))
}

/**
 * 3D knowledge-graph view: every non-archived note becomes a sphere whose
 * size grows with both its content length and how many wikilinks touch
 * it (capped). Every wikilink becomes an edge between the source note's
 * sphere and the matching target. Layout is driven by d3-force-3d
 * (charge + link distance + center). Important nodes also get a small
 * label so the graph stays legible from a distance.
 */
export function GraphView({ onClose, onPickNote }: GraphViewProps) {
  const { notes, folders } = useNoteStore()

  // Build node list (active notes only) + edge list (resolved by title).
  const { nodes, edges } = useMemo(() => {
    const folderColor = (id: string | null) =>
      id ? folders.find((f) => f.id === id)?.color ?? FOLDER_FALLBACK : FOLDER_FALLBACK
    const active = notes.filter((n) => !n.isArchived)
    const titleToId = new Map(active.map((n) => [n.title.toLowerCase(), n.id]))

    // First pass: collect raw edges (with collapsed duplicates) and degree counts.
    const wikilinkRe = /\[\[\s*([^\]\n]+?)\s*\]\]/g
    const degreeById = new Map<string, number>()
    const edgeWeights = new Map<string, number>() // key = `${src}|${tgt}`
    for (const n of active) {
      for (const m of n.content.matchAll(wikilinkRe)) {
        const target = titleToId.get(m[1].trim().toLowerCase())
        if (!target || target === n.id) continue
        const key = `${n.id}|${target}`
        edgeWeights.set(key, (edgeWeights.get(key) ?? 0) + 1)
        degreeById.set(n.id, (degreeById.get(n.id) ?? 0) + 1)
        degreeById.set(target, (degreeById.get(target) ?? 0) + 1)
      }
    }

    const ns: SimNode[] = active.map((n) => {
      const degree = degreeById.get(n.id) ?? 0
      const contentSize = n.content.length
      return {
        id: n.id,
        title: n.title,
        folderId: n.folderId,
        color: folderColor(n.folderId),
        contentSize,
        degree,
        radius: nodeRadius(contentSize, degree),
      }
    })

    const es: SimEdge[] = []
    for (const [key, weight] of edgeWeights) {
      const [source, target] = key.split('|')
      es.push({ source, target, weight })
    }
    return { nodes: ns, edges: es }
  }, [notes, folders])

  // Build the simulation once for this set of nodes/edges.
  const sim = useMemo(() => {
    if (nodes.length === 0) return null
    // Larger radii need more breathing room; pull link distance off the
    // average node size so big hubs don't smother small leaves.
    const avgR = nodes.reduce((a, n) => a + n.radius, 0) / nodes.length
    const linkDistance = Math.max(8, avgR * 6)
    const s = forceSimulation(nodes, 3)
      .force(
        'link',
        forceLink(edges)
          .id((d: SimNode) => d.id)
          .distance(linkDistance)
          .strength((e: SimEdge) => Math.min(1, 0.4 + 0.15 * e.weight)),
      )
      .force('charge', forceManyBody().strength((n: SimNode) => -22 - n.radius * 12))
      .force('center', forceCenter(0, 0, 0))
      .alpha(1)
      .alphaDecay(0.04)
      .stop()
    for (let i = 0; i < 100; i++) s.tick()
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
        <ambientLight intensity={0.7} />
        <directionalLight position={[10, 10, 10]} intensity={0.9} />
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
          <span className="ml-2 text-xs text-[var(--text-tertiary)]">
            · {hovered.degree} link{hovered.degree === 1 ? '' : 's'}
          </span>
        </div>
      )}
    </div>
  )
}

function truncate(s: string, n: number): string {
  return s.length <= n ? s : s.slice(0, n - 1).trimEnd() + '…'
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
  const labelGroupRef = useRef<THREE.Group>(null)
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

  // Per-edge vertex colours, derived from endpoint importance once at
  // build time. Computed inside the same hook that allocates the
  // buffer to keep the data immutable from React's perspective.
  const colors = useMemo(() => {
    if (!sim) return new Float32Array(0)
    const arr = new Float32Array(sim.edges.length * 6)
    sim.edges.forEach((e, i) => {
      const s = e.source as SimNode
      const t = e.target as SimNode
      const rawDeg = ((s.degree ?? 0) + (t.degree ?? 0)) / 8
      const lum = Math.min(0.95, 0.45 + Math.min(0.5, rawDeg) + Math.min(0.2, e.weight * 0.05))
      const o = i * 6
      arr[o + 0] = lum
      arr[o + 1] = lum
      arr[o + 2] = Math.min(1, lum + 0.05)
      arr[o + 3] = lum
      arr[o + 4] = lum
      arr[o + 5] = Math.min(1, lum + 0.05)
    })
    return arr
  }, [sim])

  // Decide which nodes deserve a permanent label — too many <Html> nodes
  // tank the framerate, so we cap to the top-N by importance.
  const labelledIds = useMemo(() => {
    if (!sim) return new Set<string>()
    const scored = sim.nodes
      .map((n) => ({ id: n.id, score: n.degree * 2 + Math.log10(1 + n.contentSize / 200) }))
      .sort((a, b) => b.score - a.score)
    const cap = Math.min(30, sim.nodes.length)
    return new Set(scored.slice(0, cap).map((s) => s.id))
  }, [sim])

  useFrame(() => {
    if (!sim) return
    sim.tick()

    const group = groupRef.current
    if (group) {
      sim.nodes.forEach((n, idx) => {
        const mesh = group.children[idx] as THREE.Mesh | undefined
        if (mesh && n.x != null && n.y != null && n.z != null) {
          mesh.position.set(n.x, n.y, n.z)
          // Hover bump: scale up the active mesh ~15% while keeping its
          // base radius source-of-truth.
          const targetScale = hovered?.id === n.id ? 1.15 : 1
          mesh.scale.setScalar(targetScale)
        }
      })
    }

    const labelGroup = labelGroupRef.current
    if (labelGroup) {
      let labelIdx = 0
      sim.nodes.forEach((n) => {
        if (!labelledIds.has(n.id)) return
        const obj = labelGroup.children[labelIdx++]
        if (obj && n.x != null && n.y != null && n.z != null) {
          obj.position.set(n.x, n.y + n.radius + 0.45, n.z)
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
            <sphereGeometry args={[n.radius, 20, 20]} />
            <meshStandardMaterial
              color={n.color}
              emissive={n.color}
              emissiveIntensity={0.35}
              roughness={0.45}
              metalness={0.1}
            />
          </mesh>
        ))}
      </group>

      <group ref={labelGroupRef}>
        {sim.nodes.map((n) =>
          labelledIds.has(n.id) ? (
            <Html
              key={`label-${n.id}`}
              center
              distanceFactor={18}
              zIndexRange={[40, 0]}
              style={{ pointerEvents: 'none' }}
            >
              <span
                className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-black/55 text-white whitespace-nowrap select-none"
                style={{ maxWidth: 180, display: 'inline-block', overflow: 'hidden', textOverflow: 'ellipsis' }}
              >
                {truncate(n.title, LABEL_MAX_CHARS)}
              </span>
            </Html>
          ) : null,
        )}
      </group>

      {sim.edges.length > 0 && (
        <lineSegments ref={linesRef}>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              args={[positions, 3]}
              count={sim.edges.length * 2}
            />
            <bufferAttribute
              attach="attributes-color"
              args={[colors, 3]}
              count={sim.edges.length * 2}
            />
          </bufferGeometry>
          <lineBasicMaterial vertexColors transparent opacity={0.85} />
        </lineSegments>
      )}
    </>
  )
}
