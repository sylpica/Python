"""Matplotlib backend for Python Studio: Agg rendering, plt.show() captures PNGs.
A Web Worker has no DOM, so the default browser backend cannot work there."""
from matplotlib.backends.backend_agg import FigureCanvasAgg as FigureCanvas  # noqa: F401
from matplotlib.backend_bases import FigureManagerBase as FigureManager  # noqa: F401


def show(*args, **kwargs):
    import pystudio
    pystudio.capture_figures()
