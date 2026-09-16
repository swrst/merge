using System.Collections.Generic;
using UnityEngine;

namespace DriftwoodCove.Systems
{
    /// <summary>
    /// The "Living Neighbors" twist (see the design doc's Concept section):
    /// reaching a chain's top tier spawns a resident who wanders a small patrol
    /// path near where they appeared. v1 keeps the routine to a simple back-and-
    /// forth walk; richer schedules/storylets are a v2 addition.
    /// </summary>
    public class NeighborSystem : MonoBehaviour
    {
        public Sprite NeighborSprite;
        private readonly List<Neighbor> _neighbors = new List<Neighbor>();

        private void Awake()
        {
            if (NeighborSprite == null)
                NeighborSprite = Resources.Load<Sprite>("Sprites/neighbor_villager");
        }

        public void SpawnNear(Vector3 position)
        {
            var go = new GameObject("neighbor");
            go.transform.position = position + new Vector3(0f, 0.15f, 0f);
            var sr = go.AddComponent<SpriteRenderer>();
            sr.sprite = NeighborSprite;
            sr.sortingOrder = 2;

            var neighbor = new Neighbor
            {
                Transform = go.transform,
                Origin = go.transform.position,
                PatrolRadius = Random.Range(0.6f, 1.2f),
                Speed = Random.Range(0.3f, 0.6f),
                PhaseOffset = Random.Range(0f, Mathf.PI * 2f),
            };
            _neighbors.Add(neighbor);
        }

        private void Update()
        {
            float t = Time.time;
            foreach (var n in _neighbors)
            {
                if (n.Transform == null) continue;
                float x = Mathf.Sin(t * n.Speed + n.PhaseOffset) * n.PatrolRadius;
                var pos = n.Origin;
                pos.x += x;
                n.Transform.position = pos;
            }
        }

        private class Neighbor
        {
            public Transform Transform;
            public Vector3 Origin;
            public float PatrolRadius;
            public float Speed;
            public float PhaseOffset;
        }
    }
}
