# P0.6.8 Windows Fix Preview

Source commit: d4fab87f99c27a76245ab17bbbfed908cf911943

Live stable P0.6.6 in `crans-montana-p06/` is unchanged.

The previous preview generated window instances without the required numeric façade distance. That produced NaN in instancing matrices, making all windows invisible. The fix ensures every estimated window has a finite `distance`, rejects invalid placements, and displays façade and render counts. Optional diagnostic contrast is magenta/yellow.

This page selects the Procedural mode on preview load. Switch to OFF to compare against P0.6.6 building rendering. Hybrid has no photo-verified landmark yet.

**Visual rendering against actual Ycoor geometry is not confirmed.** The diagnostic count 'envoyées au rendu' measures valid GPU instance submissions, not on-screen visibility.
