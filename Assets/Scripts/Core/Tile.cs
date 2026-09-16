using DriftwoodCove.Data;
using UnityEngine;

namespace DriftwoodCove.Core
{
    /// <summary>
    /// One board piece: either a generator (fixed, never merges, periodically
    /// spawns a tier-1 item into an empty neighboring cell) or a mergeable item.
    /// Tap input uses Unity's legacy OnMouseDown (needs a Collider2D + a Camera in
    /// the scene, both set up automatically by GameManager/GridManager). Unity
    /// maps single-finger touch to mouse events by default, so this works on
    /// Android without extra input-system setup for this v1 prototype.
    /// </summary>
    [RequireComponent(typeof(SpriteRenderer))]
    [RequireComponent(typeof(BoxCollider2D))]
    public class Tile : MonoBehaviour
    {
        public int Col;
        public int Row;
        public bool IsGenerator;
        public ItemDefinition Item; // null for generators
        public GridManager Owner;

        private SpriteRenderer _renderer;
        private static readonly Color SelectedTint = new Color(1f, 1f, 0.6f);
        private static readonly Color NormalTint = Color.white;

        public void Init(GridManager owner, int col, int row, ItemDefinition item, bool isGenerator)
        {
            Owner = owner;
            Col = col;
            Row = row;
            Item = item;
            IsGenerator = isGenerator;
            _renderer = GetComponent<SpriteRenderer>();
            ApplySprite();
        }

        public void SetItem(ItemDefinition item)
        {
            Item = item;
            ApplySprite();
        }

        private void ApplySprite()
        {
            if (_renderer == null) _renderer = GetComponent<SpriteRenderer>();
            string spriteName = IsGenerator ? "tile_bg" : Item?.SpriteFileName;
            if (string.IsNullOrEmpty(spriteName)) return;
            var sprite = Resources.Load<Sprite>($"Sprites/{spriteName}");
            if (sprite != null) _renderer.sprite = sprite;
            _renderer.sortingOrder = IsGenerator ? 0 : 1;
        }

        public void SetSelected(bool selected)
        {
            if (_renderer == null) _renderer = GetComponent<SpriteRenderer>();
            _renderer.color = selected ? SelectedTint : NormalTint;
        }

        private void OnMouseDown()
        {
            Owner?.HandleTileTapped(this);
        }
    }
}
