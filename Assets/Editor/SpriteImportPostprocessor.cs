using UnityEditor;
using UnityEngine;

namespace DriftwoodCove.EditorTools
{
    /// <summary>
    /// Forces every texture under Assets/Sprites and Assets/Art to import as a
    /// 2D Sprite with sane defaults, so the generated art needs zero manual
    /// Texture Type configuration in the Inspector before hitting Play.
    /// </summary>
    public class SpriteImportPostprocessor : AssetPostprocessor
    {
        private void OnPreprocessTexture()
        {
            if (!assetPath.Contains("/Sprites/") && !assetPath.Contains("/Art/")) return;

            var importer = (TextureImporter)assetImporter;
            importer.textureType = TextureImporterType.Sprite;
            importer.spriteImportMode = SpriteImportMode.Single;
            importer.spritePixelsPerUnit = 100f;
            importer.mipmapEnabled = false;
            importer.filterMode = FilterMode.Bilinear;
            importer.alphaIsTransparency = true;
            importer.textureCompression = TextureImporterCompression.CompressedHQ;
        }
    }
}
