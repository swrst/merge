# Driftwood Cove -- v1 Prototype Setup

This is the first playable vertical slice for the merge game described in the
"Merge Mobile Game -- Design & Development Plan" doc: a single-screen merge
board with two chains (Driftwood buildings, Shells), energy-gated generators,
auto-fulfilling orders, and the "Living Neighbors" twist (merging a chain to
its top tier spawns a wandering resident).

Everything is built from code at runtime (camera, board, HUD) so there is
**no manual scene wiring required** beyond the steps below.

## 1. Open the project

1. Open **Unity Hub** > **Add** > **Add project from disk** > select this
   `MERGE` folder.
2. Unity Hub records the project as needing version `6000.3.0f1` (Unity 6.3
   LTS). If you have a different version installed, Hub will offer to open
   it with your installed version anyway (or install the matching one) --
   either is fine for this project, there's nothing version-specific in it.
3. Let Unity import the project. On first import it will auto-generate the
   `Packages/manifest.json` and `Library/` folder -- this can take a minute
   or two the first time.

## 2. Set Rider as your script editor

In the Unity Editor: **Edit > Preferences > External Tools > External
Script Editor**, choose **JetBrains Rider**. Unity generates a `.sln` you
can also open directly from Rider (`File > Open` > the `MERGE` folder --
Rider auto-detects Unity projects).

## 3. Create the bootstrap scene

1. **File > New Scene** (Basic 2D/3D template, doesn't matter which -- the
   camera gets reconfigured by code).
2. In the Hierarchy, right-click > **Create Empty**, rename it `GameManager`.
3. Drag `Assets/Scripts/Core/GameManager.cs` onto that GameObject (or use
   **Add Component > Game Manager**).
4. **File > Save As** > save the scene as `Assets/Scenes/Main.unity`.
5. Press **Play**.

That's it -- `GameManager.Awake()` sets up the camera, builds the 6x7 board
with two generators, seeds ~78% of the remaining cells (leaving the rest
empty so a merge is always immediately available, per the design doc),
creates the HUD, and loads any existing save file.

## 4. Controls (v1)

- **Tap a generator** (left/right edge, blue-tinted tile) to spend 1 energy
  and spawn a tier-1 item into the nearest empty cell.
- **Tap two matching items** (same chain, same tier) to merge them into the
  next tier.
- Merging a **Driftwood chain item up to the Cove Lighthouse (tier 5)**
  spawns a Living Neighbor that wanders near it.
- Whenever a merge produces an item matching one of the 3 active orders
  (bottom-left HUD text), it's automatically delivered for coins -- no drag
  step in v1.
- Energy regenerates 1 point every 45 seconds (tune `SecondsPerEnergyRegen`
  on `GameManager` in the Inspector). Progress autosaves every 10 seconds
  and on pause/quit, to a JSON file in `Application.persistentDataPath`.

## 5. Art

All sprites in `Assets/Sprites/` and the store icon in
`Assets/Art/StoreAssets/` were generated programmatically (flat-design,
consistent outline/shading style) to give this slice real visual identity
instead of gray boxes. `Assets/Editor/SpriteImportPostprocessor.cs` auto-
configures every texture under those folders as a 2D Sprite on import, so
you don't need to touch import settings manually.

Treat this art as a strong placeholder set, not final production art --
see the design doc's Tools Checklist for recommended next steps (Aseprite/
Spine for hand-tuned art and the Living Neighbor's walk/idle animations).

## 6. What's deliberately not in v1 yet

Matches the design doc's phased roadmap -- these are the natural next steps,
not oversights:

- Drag-to-deliver order UI (v1 auto-fulfills on match instead)
- The Codex / collection log
- Multiple Living Neighbor types and richer storylets
- Board expansion / currency sinks beyond selling
- IAP, ads, Firebase analytics, and the energy "Boost x2" mechanic
- Prefabs and a proper ScriptableObject-based item database (v1 keeps
  `ItemDatabase.cs` as plain code so nothing needed hand-authoring Editor
  assets; converting it to `[CreateAssetMenu]` ScriptableObjects is a clean
  first upgrade once you're ready to hand tuning to a designer)

## 7. Known rough edges to watch for

- With only 2 generators and no board expansion yet, the board can fill up
  if you let energy regenerate for a long time without merging -- that's
  expected for v1; board expansion is a v2 feature per the roadmap.
- The HUD uses legacy `UnityEngine.UI.Text` (not TextMeshPro) specifically
  to avoid the "Import TMP Essentials" prompt on first open. Swap it for
  TMP whenever you start on real UI art.
