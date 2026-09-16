using System.Collections.Generic;
using System.Linq;
using DriftwoodCove.Data;
using DriftwoodCove.Systems;
using DriftwoodCove.Utils;
using UnityEngine;

namespace DriftwoodCove.Core
{
    /// <summary>
    /// Owns the merge board: a single-screen grid (no scrolling, per the design
    /// doc's #1 lesson from Travel Town), two fixed generators, and the tap-to-select
    /// / tap-to-merge interaction. Around 20-25% of non-generator cells start empty
    /// so the first merge is always immediately available.
    /// </summary>
    public class GridManager : MonoBehaviour
    {
        [Header("Board size")]
        public int Columns = 6;
        public int Rows = 7;
        public float CellSize = 1.1f;

        private Tile[,] _grid;
        private GameObject _tilePrefabRoot;
        private Tile _selected;

        private EnergySystem _energy;
        private CurrencySystem _currency;
        private OrderSystem _orders;
        private NeighborSystem _neighbors;

        public void Init(EnergySystem energy, CurrencySystem currency, OrderSystem orders, NeighborSystem neighbors)
        {
            _energy = energy;
            _currency = currency;
            _orders = orders;
            _neighbors = neighbors;

            _grid = new Tile[Columns, Rows];
            _tilePrefabRoot = new GameObject("Board");
            _tilePrefabRoot.transform.SetParent(transform, false);

            BuildBackground();
            PlaceGenerators();
            SeedBoard();
        }

        private void BuildBackground()
        {
            var bgRoot = new GameObject("Background");
            bgRoot.transform.SetParent(transform, false);
            var bgSprite = Resources.Load<Sprite>("Sprites/tile_bg");
            for (int c = 0; c < Columns; c++)
            for (int r = 0; r < Rows; r++)
            {
                var go = new GameObject($"bg_{c}_{r}");
                go.transform.SetParent(bgRoot.transform, false);
                go.transform.position = GridUtils.CellToWorld(c, r, Columns, Rows, CellSize);
                var sr = go.AddComponent<SpriteRenderer>();
                sr.sprite = bgSprite;
                sr.sortingOrder = -1;
            }
        }

        private void PlaceGenerators()
        {
            int midRow = Rows / 2;
            SpawnTile(0, midRow, ItemDatabase.Get(ItemDatabase.DriftwoodChain, 1), isGenerator: true);
            SpawnTile(Columns - 1, midRow, ItemDatabase.Get(ItemDatabase.ShellChain, 1), isGenerator: true);
        }

        private void SeedBoard()
        {
            var seeds = ItemDatabase.GeneratorSeeds();
            var freeCells = AllCells().Where(cell => _grid[cell.col, cell.row] == null).ToList();
            Shuffle(freeCells);

            // Fill ~75-80% of remaining free cells, leaving 20-25% empty per the design doc.
            int fillCount = Mathf.RoundToInt(freeCells.Count * 0.78f);
            for (int i = 0; i < fillCount; i++)
            {
                var cell = freeCells[i];
                var seed = seeds[Random.Range(0, seeds.Count)];
                // Occasionally seed a tier-2 item so an early merge is possible immediately.
                var item = Random.value < 0.35f && ItemDatabase.Get(seed.ChainId, 2) != null
                    ? ItemDatabase.Get(seed.ChainId, 2)
                    : seed;
                SpawnTile(cell.col, cell.row, item, isGenerator: false);
            }
        }

        private IEnumerable<(int col, int row)> AllCells()
        {
            for (int c = 0; c < Columns; c++)
            for (int r = 0; r < Rows; r++)
                yield return (c, r);
        }

        private static void Shuffle<T>(IList<T> list)
        {
            for (int i = list.Count - 1; i > 0; i--)
            {
                int j = Random.Range(0, i + 1);
                (list[i], list[j]) = (list[j], list[i]);
            }
        }

        private Tile SpawnTile(int col, int row, ItemDefinition item, bool isGenerator)
        {
            var go = new GameObject(isGenerator ? "generator" : "tile");
            go.transform.SetParent(_tilePrefabRoot.transform, false);
            go.transform.position = GridUtils.CellToWorld(col, row, Columns, Rows, CellSize);
            go.AddComponent<SpriteRenderer>();
            var collider = go.AddComponent<BoxCollider2D>();
            collider.size = Vector2.one * (CellSize * 0.9f);
            var tile = go.AddComponent<Tile>();
            tile.Init(this, col, row, item, isGenerator);
            if (isGenerator)
                tile.SetSelected(false); // ensure normal tint; generators get a blue tint below
            _grid[col, row] = tile;
            return tile;
        }

        private List<(int col, int row)> EmptyCells()
        {
            var list = new List<(int col, int row)>();
            foreach (var cell in AllCells())
                if (_grid[cell.col, cell.row] == null)
                    list.Add(cell);
            return list;
        }

        public void HandleTileTapped(Tile tile)
        {
            if (tile.IsGenerator)
            {
                TryGenerate(tile);
                return;
            }

            if (_selected == null)
            {
                _selected = tile;
                tile.SetSelected(true);
                return;
            }

            if (_selected == tile)
            {
                tile.SetSelected(false);
                _selected = null;
                return;
            }

            if (_selected.Item != null && tile.Item != null &&
                _selected.Item.ChainId == tile.Item.ChainId && _selected.Item.Tier == tile.Item.Tier)
            {
                TryMerge(_selected, tile);
            }
            else
            {
                _selected.SetSelected(false);
                _selected = tile;
                tile.SetSelected(true);
            }
        }

        private const int GenerateEnergyCost = 1;

        private void TryGenerate(Tile generator)
        {
            var empties = EmptyCells();
            if (empties.Count == 0) return;
            if (_energy == null || !_energy.TryConsume(GenerateEnergyCost)) return;

            var best = empties
                .OrderBy(c => Mathf.Abs(c.col - generator.Col) + Mathf.Abs(c.row - generator.Row))
                .First();
            SpawnTile(best.col, best.row, generator.Item, isGenerator: false);
        }

        private void TryMerge(Tile a, Tile b)
        {
            var next = ItemDatabase.Next(a.Item);
            if (next == null)
            {
                // Already at max tier for this chain; nothing higher to become.
                a.SetSelected(false);
                _selected = null;
                return;
            }

            _grid[b.Col, b.Row] = null;
            Destroy(b.gameObject);

            a.SetItem(next);
            a.SetSelected(false);
            _selected = null;

            if (next.SpawnsNeighbor)
                _neighbors?.SpawnNear(a.transform.position);

            if (_orders != null && _orders.TryAutoFulfill(next, out int reward))
            {
                _grid[a.Col, a.Row] = null;
                Destroy(a.gameObject);
                _currency?.Add(reward);
            }
        }

        // ----- Save/Load support -----

        public List<SaveSystem.TileSave> CaptureState()
        {
            var list = new List<SaveSystem.TileSave>();
            foreach (var cell in AllCells())
            {
                var t = _grid[cell.col, cell.row];
                if (t == null || t.IsGenerator || t.Item == null) continue;
                list.Add(new SaveSystem.TileSave { col = cell.col, row = cell.row, chainId = t.Item.ChainId, tier = t.Item.Tier });
            }
            return list;
        }

        public void RestoreState(List<SaveSystem.TileSave> tiles)
        {
            if (tiles == null) return;
            // Clear any non-generator tiles the fresh SeedBoard put down, then apply the save.
            foreach (var cell in AllCells())
            {
                var t = _grid[cell.col, cell.row];
                if (t != null && !t.IsGenerator)
                {
                    Destroy(t.gameObject);
                    _grid[cell.col, cell.row] = null;
                }
            }
            foreach (var save in tiles)
            {
                var item = ItemDatabase.Get(save.chainId, save.tier);
                if (item != null) SpawnTile(save.col, save.row, item, isGenerator: false);
            }
        }
    }
}
