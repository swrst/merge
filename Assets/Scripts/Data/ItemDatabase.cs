using System.Collections.Generic;
using System.Linq;

namespace DriftwoodCove.Data
{
    /// <summary>
    /// Central, code-authored database for both v1 merge chains. Static so any
    /// system can query it without needing a scene reference. See ItemDefinition
    /// for why this is plain code rather than a ScriptableObject in v1.
    /// </summary>
    public static class ItemDatabase
    {
        public const string DriftwoodChain = "driftwood";
        public const string ShellChain = "shell";

        private static readonly List<ItemDefinition> Items = new List<ItemDefinition>
        {
            // Driftwood chain: buildings. Reaching the top tier (the Lighthouse)
            // spawns a Living Neighbor, per the design doc's core twist.
            new ItemDefinition(DriftwoodChain, 1, "Driftwood Twig",   "driftwood_1", isGeneratorSeed: true, sellValue: 2),
            new ItemDefinition(DriftwoodChain, 2, "Driftwood Bundle", "driftwood_2", sellValue: 5),
            new ItemDefinition(DriftwoodChain, 3, "Beach Hut",        "driftwood_3", sellValue: 12),
            new ItemDefinition(DriftwoodChain, 4, "Cozy Cottage",     "driftwood_4", sellValue: 30),
            new ItemDefinition(DriftwoodChain, 5, "Cove Lighthouse",  "driftwood_5", spawnsNeighbor: true, sellValue: 75),

            // Shell chain: collectibles/currency-ish items feeding orders and the Codex.
            new ItemDefinition(ShellChain, 1, "Small Shell",   "shell_1", isGeneratorSeed: true, sellValue: 1),
            new ItemDefinition(ShellChain, 2, "Shell Cluster", "shell_2", sellValue: 4),
            new ItemDefinition(ShellChain, 3, "Pearl Oyster",  "shell_3", sellValue: 10),
            new ItemDefinition(ShellChain, 4, "Shining Pearl", "shell_4", sellValue: 24),
            new ItemDefinition(ShellChain, 5, "Pearl Crown",   "shell_5", sellValue: 60),
        };

        public static IReadOnlyList<string> ChainIds { get; } = new List<string> { DriftwoodChain, ShellChain };

        public static ItemDefinition Get(string chainId, int tier)
            => Items.FirstOrDefault(i => i.ChainId == chainId && i.Tier == tier);

        public static int MaxTier(string chainId)
            => Items.Where(i => i.ChainId == chainId).Max(i => i.Tier);

        public static List<ItemDefinition> GeneratorSeeds()
            => Items.Where(i => i.IsGeneratorSeed).ToList();

        public static ItemDefinition Next(ItemDefinition current)
            => Get(current.ChainId, current.Tier + 1);

        public static bool IsTopTier(ItemDefinition item)
            => item.Tier >= MaxTier(item.ChainId);
    }
}
