using System;
using System.Collections.Generic;
using DriftwoodCove.Data;
using UnityEngine;

namespace DriftwoodCove.Systems
{
    public class Order
    {
        public string ChainId;
        public int Tier;
        public int CoinReward;
        public ItemDefinition Item => ItemDatabase.Get(ChainId, Tier);
    }

    /// <summary>
    /// Townspeople requests. Keeps a small fixed number of active orders; when one
    /// is fulfilled (see TryAutoFulfill) it is replaced with a freshly rolled one.
    /// v1 auto-fulfills the moment a matching tile exists on the board, which keeps
    /// the loop simple; a drag-to-deliver UI is a natural v2 addition (see README).
    /// </summary>
    public class OrderSystem
    {
        public const int ActiveOrderCount = 3;
        public List<Order> ActiveOrders { get; } = new List<Order>();

        public event Action Changed;
        public event Action<Order> Fulfilled;

        private readonly System.Random _rng = new System.Random();

        public void GenerateInitialOrders()
        {
            ActiveOrders.Clear();
            for (int i = 0; i < ActiveOrderCount; i++)
                ActiveOrders.Add(RollOrder());
            Changed?.Invoke();
        }

        public void LoadState(System.Collections.Generic.List<SaveSystem.OrderSave> savedOrders)
        {
            if (savedOrders == null || savedOrders.Count == 0)
            {
                GenerateInitialOrders();
                return;
            }
            ActiveOrders.Clear();
            foreach (var s in savedOrders)
                ActiveOrders.Add(new Order { ChainId = s.chainId, Tier = s.tier, CoinReward = s.coinReward });
            Changed?.Invoke();
        }

        private Order RollOrder()
        {
            var chainId = ItemDatabase.ChainIds[_rng.Next(ItemDatabase.ChainIds.Count)];
            int maxTier = Mathf.Min(3, ItemDatabase.MaxTier(chainId)); // keep early orders reachable
            int tier = _rng.Next(1, maxTier + 1);
            var item = ItemDatabase.Get(chainId, tier);
            int reward = Mathf.Max(3, item.SellValue * 2);
            return new Order { ChainId = chainId, Tier = tier, CoinReward = reward };
        }

        /// <summary>Returns the reward if a matching order exists for this item, replacing that order.</summary>
        public bool TryAutoFulfill(ItemDefinition item, out int coinReward)
        {
            coinReward = 0;
            var match = ActiveOrders.Find(o => o.ChainId == item.ChainId && o.Tier == item.Tier);
            if (match == null) return false;

            coinReward = match.CoinReward;
            int index = ActiveOrders.IndexOf(match);
            ActiveOrders[index] = RollOrder();
            Fulfilled?.Invoke(match);
            Changed?.Invoke();
            return true;
        }
    }
}
