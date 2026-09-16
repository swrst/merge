using System;

namespace DriftwoodCove.Data
{
    /// <summary>
    /// Describes one tier of one merge chain. Plain C# class for now (v1) so the
    /// whole database can be authored in code without needing Editor-created
    /// ScriptableObject assets. A natural v2 step is converting this into a
    /// ScriptableObject (see ItemDatabase.cs) so designers can tune it without code.
    /// </summary>
    [Serializable]
    public class ItemDefinition
    {
        public string ChainId;          // e.g. "driftwood", "shell"
        public int Tier;                // 1-based tier within the chain
        public string DisplayName;      // shown in HUD / orders
        public string SpriteFileName;   // file name under Resources/Sprites (no extension)
        public bool IsGeneratorSeed;    // true for tier-1 items generators can spawn
        public bool SpawnsNeighbor;     // true if reaching this tier spawns a Living Neighbor
        public int SellValue;           // coins if sold directly (unused by default loop, handy for v2)

        public ItemDefinition(string chainId, int tier, string displayName, string spriteFileName,
            bool isGeneratorSeed = false, bool spawnsNeighbor = false, int sellValue = 0)
        {
            ChainId = chainId;
            Tier = tier;
            DisplayName = displayName;
            SpriteFileName = spriteFileName;
            IsGeneratorSeed = isGeneratorSeed;
            SpawnsNeighbor = spawnsNeighbor;
            SellValue = sellValue;
        }

        public string Key => $"{ChainId}:{Tier}";
    }
}
