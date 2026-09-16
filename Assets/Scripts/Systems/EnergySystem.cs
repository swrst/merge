using System;
using UnityEngine;

namespace DriftwoodCove.Systems
{
    /// <summary>
    /// Energy is the primary soft-currency gate on generator taps, per the design
    /// doc's competitive research (Travel Town's proven approach). Regenerates
    /// slowly over real time; players can also earn bursts from orders.
    /// </summary>
    public class EnergySystem
    {
        public int Max { get; private set; }
        public int Current { get; private set; }
        public float SecondsPerRegen { get; private set; }

        private float _regenTimer;

        public event Action Changed;

        public EnergySystem(int max, float secondsPerRegen, int startingEnergy = -1)
        {
            Max = max;
            SecondsPerRegen = secondsPerRegen;
            Current = startingEnergy < 0 ? max : Mathf.Clamp(startingEnergy, 0, max);
        }

        public void Tick(float deltaTime)
        {
            if (Current >= Max) return;
            _regenTimer += deltaTime;
            if (_regenTimer >= SecondsPerRegen)
            {
                _regenTimer -= SecondsPerRegen;
                Current = Mathf.Min(Max, Current + 1);
                Changed?.Invoke();
            }
        }

        public bool TryConsume(int amount)
        {
            if (Current < amount) return false;
            Current -= amount;
            Changed?.Invoke();
            return true;
        }

        public void Add(int amount)
        {
            Current = Mathf.Clamp(Current + amount, 0, Max);
            Changed?.Invoke();
        }

        public void LoadState(int current)
        {
            Current = Mathf.Clamp(current, 0, Max);
            Changed?.Invoke();
        }
    }
}
