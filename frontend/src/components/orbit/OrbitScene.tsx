import { useEffect, useRef, useState } from "react"
import type { Vector3 } from "three"

import { orbitRadiusScale } from "../../lib/orbit"

type OrbitSceneProps = {
  altitudeKm: number
  inclinationDeg: number
  radiusM: number | undefined
  earthRadiusM: number | undefined
  isSunSynchronous: boolean
}

type ThreeModule = typeof import("three")

function gridGeometry(THREE: ThreeModule) {
  const points: number[] = []
  const segments = 96

  for (const latDeg of [-60, -30, 0, 30, 60]) {
    const lat = (latDeg * Math.PI) / 180
    const ringRadius = Math.cos(lat)
    const y = Math.sin(lat)
    for (let index = 0; index < segments; index += 1) {
      const a = (index / segments) * Math.PI * 2
      const b = ((index + 1) / segments) * Math.PI * 2
      points.push(
        Math.cos(a) * ringRadius,
        y,
        Math.sin(a) * ringRadius,
        Math.cos(b) * ringRadius,
        y,
        Math.sin(b) * ringRadius,
      )
    }
  }

  for (let lonDeg = 0; lonDeg < 180; lonDeg += 30) {
    const lon = (lonDeg * Math.PI) / 180
    for (let index = 0; index < segments; index += 1) {
      const a = (index / segments) * Math.PI * 2
      const b = ((index + 1) / segments) * Math.PI * 2
      points.push(
        Math.cos(a) * Math.cos(lon),
        Math.sin(a),
        Math.cos(a) * Math.sin(lon),
        Math.cos(b) * Math.cos(lon),
        Math.sin(b),
        Math.cos(b) * Math.sin(lon),
      )
    }
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(points, 3))
  return geometry
}

function glowTexture(THREE: ThreeModule) {
  const canvas = document.createElement("canvas")
  canvas.width = 64
  canvas.height = 64
  const context = canvas.getContext("2d")
  if (context) {
    const gradient = context.createRadialGradient(32, 32, 0, 32, 32, 32)
    gradient.addColorStop(0, "rgba(255, 181, 71, 0.95)")
    gradient.addColorStop(0.35, "rgba(255, 181, 71, 0.35)")
    gradient.addColorStop(1, "rgba(255, 181, 71, 0)")
    context.fillStyle = gradient
    context.fillRect(0, 0, 64, 64)
  }
  return new THREE.CanvasTexture(canvas)
}

function starField(THREE: ThreeModule) {
  const count = 700
  const positions = new Float32Array(count * 3)
  let seed = 20261114
  const random = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0
    return seed / 4294967296
  }

  for (let index = 0; index < count; index += 1) {
    const radius = 12 + random() * 18
    const theta = random() * Math.PI * 2
    const phi = Math.acos(2 * random() - 1)
    positions[index * 3] = radius * Math.sin(phi) * Math.cos(theta)
    positions[index * 3 + 1] = radius * Math.cos(phi)
    positions[index * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta)
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3))
  return new THREE.Points(
    geometry,
    new THREE.PointsMaterial({
      color: 0x8394a8,
      size: 0.035,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.65,
    }),
  )
}

export function OrbitScene({
  altitudeKm,
  inclinationDeg,
  radiusM,
  earthRadiusM,
  isSunSynchronous,
}: OrbitSceneProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [status, setStatus] = useState<"booting" | "ready" | "failed">("booting")
  const paramsRef = useRef({ orbitScale: 1.1, inclinationRad: 0 })

  useEffect(() => {
    paramsRef.current = {
      orbitScale:
        radiusM !== undefined && earthRadiusM !== undefined
          ? orbitRadiusScale(radiusM, earthRadiusM)
          : 1.1,
      inclinationRad: (inclinationDeg * Math.PI) / 180,
    }
  }, [radiusM, earthRadiusM, inclinationDeg])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    let disposed = false
    let cleanup: (() => void) | null = null

    void (async () => {
      try {
        const [THREE, controlsModule] = await Promise.all([
          import("three"),
          import("three/examples/jsm/controls/OrbitControls.js"),
        ])
        if (disposed) return

        const probe = document.createElement("canvas")
        const context = probe.getContext("webgl2") ?? probe.getContext("webgl")
        if (!context) {
          setStatus("failed")
          return
        }

        const scene = new THREE.Scene()
        const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100)
        camera.position.set(0, 2.1, 4.5)

        const renderer = new THREE.WebGLRenderer({
          antialias: true,
          alpha: true,
          powerPreference: "high-performance",
        })
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
        renderer.setClearColor(0x000000, 0)
        renderer.domElement.style.display = "block"
        renderer.domElement.style.width = "100%"
        renderer.domElement.style.height = "100%"
        container.appendChild(renderer.domElement)

        const controls = new controlsModule.OrbitControls(camera, renderer.domElement)
        controls.enableDamping = true
        controls.dampingFactor = 0.08
        controls.enablePan = false
        controls.minDistance = 2.1
        controls.maxDistance = 8.0
        controls.rotateSpeed = 0.6
        controls.zoomSpeed = 0.7

        scene.add(new THREE.AmbientLight(0xbfe9ff, 0.55))
        const keyLight = new THREE.DirectionalLight(0x9be8ff, 2.4)
        keyLight.position.set(3, 2, 4)
        scene.add(keyLight)
        const rimLight = new THREE.DirectionalLight(0xffb547, 0.5)
        rimLight.position.set(-4, -2, -3)
        scene.add(rimLight)

        scene.add(starField(THREE))

        const earthGroup = new THREE.Group()
        scene.add(earthGroup)

        const earth = new THREE.Mesh(
          new THREE.SphereGeometry(1, 64, 48),
          new THREE.MeshStandardMaterial({
            color: 0x0b2433,
            roughness: 0.72,
            metalness: 0.18,
            emissive: 0x04141d,
            emissiveIntensity: 1,
          }),
        )
        earthGroup.add(earth)

        earthGroup.add(
          new THREE.LineSegments(
            gridGeometry(THREE),
            new THREE.LineBasicMaterial({
              color: 0x38e8c6,
              transparent: true,
              opacity: 0.2,
            }),
          ),
        )

        const equatorPoints: number[] = []
        for (let index = 0; index <= 128; index += 1) {
          const angle = (index / 128) * Math.PI * 2
          equatorPoints.push(Math.cos(angle) * 1.001, 0, Math.sin(angle) * 1.001)
        }
        const equatorGeometry = new THREE.BufferGeometry()
        equatorGeometry.setAttribute(
          "position",
          new THREE.Float32BufferAttribute(equatorPoints, 3),
        )
        earthGroup.add(
          new THREE.Line(
            equatorGeometry,
            new THREE.LineBasicMaterial({
              color: 0x38e8c6,
              transparent: true,
              opacity: 0.45,
            }),
          ),
        )

        earthGroup.add(
          new THREE.Mesh(
            new THREE.SphereGeometry(1.025, 64, 48),
            new THREE.MeshBasicMaterial({
              color: 0x38e8c6,
              transparent: true,
              opacity: 0.06,
              side: THREE.BackSide,
              blending: THREE.AdditiveBlending,
              depthWrite: false,
            }),
          ),
        )

        scene.add(
          new THREE.Line(
            new THREE.BufferGeometry().setFromPoints([
              new THREE.Vector3(0, -1.3, 0),
              new THREE.Vector3(0, 1.3, 0),
            ]),
            new THREE.LineBasicMaterial({
              color: 0x8394a8,
              transparent: true,
              opacity: 0.25,
            }),
          ),
        )

        const orbitGroup = new THREE.Group()
        const orbitPoints: Vector3[] = []
        for (let index = 0; index <= 256; index += 1) {
          const angle = (index / 256) * Math.PI * 2
          orbitPoints.push(new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle)))
        }
        orbitGroup.add(
          new THREE.Line(
            new THREE.BufferGeometry().setFromPoints(orbitPoints),
            new THREE.LineBasicMaterial({
              color: 0x38e8c6,
              transparent: true,
              opacity: 0.95,
            }),
          ),
        )
        scene.add(orbitGroup)

        const satellitePivot = new THREE.Group()
        const satellite = new THREE.Mesh(
          new THREE.SphereGeometry(0.034, 16, 12),
          new THREE.MeshBasicMaterial({ color: 0xffb547 }),
        )
        const glow = glowTexture(THREE)
        const sprite = new THREE.Sprite(
          new THREE.SpriteMaterial({
            map: glow,
            color: 0xffb547,
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
          }),
        )
        sprite.scale.setScalar(0.2)
        satellite.add(sprite)
        satellitePivot.add(satellite)
        scene.add(satellitePivot)

        const resize = () => {
          const width = container.clientWidth
          const height = container.clientHeight
          if (!width || !height) return
          renderer.setSize(width, height, false)
          camera.aspect = width / height
          camera.updateProjectionMatrix()
        }
        const observer = new ResizeObserver(resize)
        observer.observe(container)
        resize()

        const clock = new THREE.Clock()
        let frame = 0
        const animate = () => {
          frame = requestAnimationFrame(animate)
          const elapsed = clock.getElapsedTime()
          const { orbitScale, inclinationRad } = paramsRef.current

          orbitGroup.scale.setScalar(orbitScale)
          orbitGroup.rotation.x = inclinationRad
          satellitePivot.rotation.x = inclinationRad

          const angle = 0.6 + elapsed * 0.18
          satellite.position.set(
            Math.cos(angle) * orbitScale,
            0,
            Math.sin(angle) * orbitScale,
          )
          earthGroup.rotation.y = elapsed * 0.04

          controls.update()
          renderer.render(scene, camera)
        }
        animate()

        cleanup = () => {
          cancelAnimationFrame(frame)
          observer.disconnect()
          controls.dispose()
          scene.traverse((object) => {
            if (
              object instanceof THREE.Mesh ||
              object instanceof THREE.Line ||
              object instanceof THREE.LineSegments ||
              object instanceof THREE.Points
            ) {
              object.geometry.dispose()
              const material = object.material
              if (Array.isArray(material)) {
                material.forEach((entry) => entry.dispose())
              } else {
                material.dispose()
              }
            } else if (object instanceof THREE.Sprite) {
              object.material.dispose()
            }
          })
          glow.dispose()
          renderer.dispose()
          renderer.domElement.remove()
        }

        setStatus("ready")
      } catch {
        if (!disposed) setStatus("failed")
      }
    })()

    return () => {
      disposed = true
      cleanup?.()
    }
  }, [])

  return (
    <div className="relative overflow-hidden border border-edge bg-[#050a12]">
      <div
        ref={containerRef}
        className="h-[430px] w-full"
        role="img"
        aria-label="3D Earth with the planned circular orbit and satellite marker"
      />

      <div className="pointer-events-none absolute left-3 top-3 text-[9px] tracking-[0.24em] text-muted">
        EARTH · 3D ORBIT VIEW
      </div>
      <div className="pointer-events-none absolute right-3 top-3 text-right text-[9px] tracking-[0.18em] text-muted/80">
        <div>
          ALT {altitudeKm.toFixed(0)} KM · INC {inclinationDeg.toFixed(2)}°
        </div>
        <div className="mt-1">EARTH RADIUS 6,378.1 KM</div>
      </div>

      {isSunSynchronous ? (
        <div className="pointer-events-none absolute left-3 top-9 border border-signal/50 bg-signal/10 px-2 py-0.5 text-[8px] tracking-[0.18em] text-signal">
          SUN-SYNCHRONOUS
        </div>
      ) : null}

      <div className="pointer-events-none absolute bottom-3 left-3 text-[8px] tracking-[0.14em] text-muted/70">
        DRAG TO ROTATE · SCROLL TO ZOOM
      </div>
      <div className="pointer-events-none absolute bottom-3 right-3 text-[8px] tracking-[0.14em] text-muted/70">
        ORBIT MOTION IS SCHEMATIC
      </div>

      {status !== "ready" ? (
        <div className="absolute inset-0 grid place-items-center bg-[#050a12]/80 text-center">
          {status === "failed" ? (
            <div className="max-w-xs px-4">
              <p className="text-[10px] tracking-[0.3em] text-alert">3D VIEW UNAVAILABLE</p>
              <p className="mt-2 text-[11px] leading-relaxed text-muted">
                WebGL is not available in this browser. Orbital metrics remain fully
                operational in the adjacent panels.
              </p>
            </div>
          ) : (
            <div>
              <p className="text-[10px] tracking-[0.3em] text-signal">INITIALISING GLOBE</p>
              <p className="mt-2 text-[10px] tracking-[0.12em] text-muted">
                THREE.JS · WEBGL
              </p>
            </div>
          )}
        </div>
      ) : null}
    </div>
  )
}
