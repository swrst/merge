using System;
using UnityEngine;

namespace DriftwoodCove.Systems
{
    public class CurrencySystem
    {
        public int Coins { get; private set; }
        public event Action Changed;

        public CurrencySystem(int startingCoins = 0)
        {
            Coins = startingCoins;
        }

        public void Add(int amount)
        {
            if (amount == 0) return;
            Coins = Mathf.Max(0, Coins + amount);
            Changed?.Invoke();
        }

        public bool TrySpend(int amount)
        {
            if (Coins < amount) return false;
            Coins -= amount;
            Changed?.Invoke();
            return true;
        }

        public void LoadState(int coins)
        {
            Coins = Mathf.Max(0, coins);
            Changed?.Invoke();
        }
    }
}
