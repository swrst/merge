using System;
using System.Collections.Generic;
using System.IO;
using UnityEngine;

namespace DriftwoodCove.Systems
{
    /// <summary>
    /// Minimal JSON save/load to Application.persistentDataPath. Deliberately plain
    /// (no cloud sync, no versioning) for v1 -- enough to keep progress between
    /// sessions on one device while the rest of the loop is being proven out.
    /// </summary>
    public static class SaveSystem
    {
        private const string FileName = "driftwoodcove_save.json";
        private static string PathOnDisk => Path.Combine(Application.persistentDataPath, FileName);

        [Serializable]
        public class TileSave
        {
            public int col;
            public int row;
            public string chainId;
            public int tier;
        }

        [Serializable]
        public class OrderSave
        {
            public string chainId;
            public int tier;
            public int coinReward;
        }

        [Serializable]
        public class SaveData
        {
            public int energy;
            public int coins;
            public List<TileSave> tiles = new List<TileSave>();
            public List<OrderSave> orders = new List<OrderSave>();
        }

        public static void Save(SaveData data)
        {
            try
            {
                string json = JsonUtility.ToJson(data, prettyPrint: true);
                File.WriteAllText(PathOnDisk, json);
            }
            catch (Exception e)
            {
                Debug.LogWarning($"[SaveSystem] Save failed: {e.Message}");
            }
        }

        public static SaveData Load()
        {
            try
            {
                if (!File.Exists(PathOnDisk)) return null;
                string json = File.ReadAllText(PathOnDisk);
                return JsonUtility.FromJson<SaveData>(json);
            }
            catch (Exception e)
            {
                Debug.LogWarning($"[SaveSystem] Load failed: {e.Message}");
                return null;
            }
        }
    }
}
