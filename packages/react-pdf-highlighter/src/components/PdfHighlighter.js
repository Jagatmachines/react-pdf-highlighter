// @flow
import React, { PureComponent } from "react";
import ReactDom from "react-dom";
import Pointable from "react-pointable";
import debounce from "lodash.debounce";

import { EventBus, PDFViewer, PDFLinkService } from "pdfjs-dist/web/pdf_viewer";

//$FlowFixMe
import "pdfjs-dist/web/pdf_viewer.css";
import "../style/pdf_viewer.css";

import "../style/PdfHighlighter.css";

import getBoundingRect from "../lib/get-bounding-rect";
import getClientRects from "../lib/get-client-rects";
import getAreaAsPng from "../lib/get-area-as-png";

import {
  asElement,
  getPageFromRange,
  getPageFromElement,
  getWindow,
  findOrCreateContainerLayer,
  isHTMLElement
} from "../lib/pdfjs-dom";

import TipContainer from "./TipContainer";
import MouseSelection from "./MouseSelection";
import ToolBar from "./ToolBar";

import { scaledToViewport, viewportToScaled } from "../lib/coordinates";

import type {
  T_Position,
  T_ScaledPosition,
  T_Highlight,
  T_Scaled,
  T_LTWH,
  T_EventBus,
  T_PDFJS_Viewer,
  T_PDFJS_Document,
  T_PDFJS_LinkService,
  T_ToolBarItem
} from "../types";

type T_ViewportHighlight<T_HT> = { position: T_Position } & T_HT;

type State<T_HT> = {
  ghostHighlight: ?[
    {
      position: T_ScaledPosition
    }
  ],
  isCollapsed: boolean,
  range: ?Range,
  tip: ?{
    highlight: T_ViewportHighlight<T_HT>,
    callback: (highlight: T_ViewportHighlight<T_HT>) => React$Element<*>
  },
  isAreaSelectionInProgress: boolean,
  scrolledToHighlightId: string,
  clientPosition: {
    xPos: number,
    yPos: number
  },
  areaHighlightEnable: boolean
};

type Props<T_HT> = {
  highlightTransform: (
    highlight: T_ViewportHighlight<T_HT>,
    index: number,
    setTip: (
      highlight: T_ViewportHighlight<T_HT>,
      callback: (highlight: T_ViewportHighlight<T_HT>) => React$Element<*>
    ) => void,
    hideTip: () => void,
    viewportToScaled: (rect: T_LTWH) => T_Scaled,
    screenshot: (position: T_LTWH) => string,
    isScrolledTo: boolean
  ) => React$Element<*>,
  highlights: Array<T_HT>,
  onScrollChange: () => void,
  scrollRef: (scrollTo: (highlight: T_Highlight) => void) => void,
  pdfDocument: T_PDFJS_Document,
  pdfScaleValue: string,
  onSelectionFinished: (
    position: T_ScaledPosition,
    content: { text?: string, image?: string },
    hideTipAndSelection: () => void,
    transformSelection: () => void,
    clientPosition: {
      xPos: number,
      yPos: number
    }
  ) => ?React$Element<*>,
  enableAreaSelection: (event: MouseEvent) => boolean,
  showToolBar: T_ToolBarItem,
  updateRotate: (rotatePages: (delta: string) => void, delta: string) => void,
  showRotationWarning?: boolean,
  showRotationWarningFunc?: () => void,
  rotatePdf?: number,
  saveRotation?: (delta: number) => void,
  rotationModalConfirmation?: (
    rotatePages: (delta: number) => void
  ) => React$Element<*>
};

const EMPTY_ID = "empty-id";

class PdfHighlighter<T_HT: T_Highlight> extends PureComponent<
  Props<T_HT>,
  State<T_HT>
> {
  static defaultProps = {
    pdfScaleValue: "auto"
  };

  state: State<T_HT> = {
    ghostHighlight: [],
    isCollapsed: true,
    range: null,
    scrolledToHighlightId: EMPTY_ID,
    isAreaSelectionInProgress: false,
    tip: null,
    clientPosition: {
      xPos: 0,
      yPos: 0
    },
    rangeArray: [],
    areaHighlightEnable: false
  };

  eventBus: T_EventBus = new EventBus();
  linkService: T_PDFJS_LinkService = new PDFLinkService({
    eventBus: this.eventBus
  });
  viewer: T_PDFJS_Viewer;

  resizeObserver = null;
  containerNode: ?HTMLDivElement = null;
  unsubscribe = () => {};

  constructor(props: Props<T_HT>) {
    super(props);
    if (typeof ResizeObserver !== "undefined") {
      this.resizeObserver = new ResizeObserver(this.debouncedScaleValue);
    }
  }

  componentDidMount() {
    this.init();
  }

  attachRef = (ref: ?HTMLDivElement) => {
    const { eventBus, resizeObserver: observer } = this;
    this.containerNode = ref;
    this.unsubscribe();

    if (ref) {
      const { ownerDocument: doc } = ref;
      eventBus.on("textlayerrendered", this.onTextLayerRendered);
      eventBus.on("pagesinit", this.onDocumentReady);
      doc.addEventListener("selectionchange", this.onSelectionChange);
      doc.addEventListener("keydown", this.handleKeyDown);
      doc.addEventListener("click", this.handleClick);
      doc.defaultView.addEventListener("resize", this.debouncedScaleValue);
      if (observer) observer.observe(ref);

      this.unsubscribe = () => {
        eventBus.off("pagesinit", this.onDocumentReady);
        eventBus.off("textlayerrendered", this.onTextLayerRendered);
        doc.removeEventListener("selectionchange", this.onSelectionChange);
        doc.removeEventListener("keydown", this.handleKeyDown);
        doc.removeEventListener("click", this.handleClick);
        doc.defaultView.removeEventListener("resize", this.debouncedScaleValue);
        if (observer) observer.disconnect();
      };
    }
  };

  componentDidUpdate(prevProps: Props<T_HT>) {
    if (prevProps.pdfDocument !== this.props.pdfDocument) {
      this.init();
      return;
    }
    if (prevProps.highlights !== this.props.highlights) {
      this.renderHighlights(this.props);
    }
  }

  init() {
    const { pdfDocument } = this.props;

    document.addEventListener("click", this.handleClick);

    this.viewer =
      this.viewer ||
      new PDFViewer({
        container: this.containerNode,
        eventBus: this.eventBus,
        enhanceTextSelection: true,
        removePageBorders: true,
        linkService: this.linkService
      });

    this.linkService.setDocument(pdfDocument);
    this.linkService.setViewer(this.viewer);
    this.viewer.setDocument(pdfDocument);

    if (this.props.rotatePdf) {
      this.viewer.pagesPromise.then(() => {
        this.rotatePages(this.props.rotatePdf);
      });
    }

    // debug
    window.PdfViewer = this;
  }

  componentWillUnmount() {
    this.unsubscribe();
  }

  findOrCreateHighlightLayer(page: number) {
    const { textLayer } = this.viewer.getPageView(page - 1) || {};

    if (!textLayer) {
      return null;
    }

    return findOrCreateContainerLayer(
      textLayer.textLayerDiv,
      "PdfHighlighter__highlight-layer"
    );
  }

  groupHighlightsByPage(
    highlights: Array<T_HT>
  ): { [pageNumber: string]: Array<T_HT> } {
    const { ghostHighlight } = this.state;

    return [...highlights, ...ghostHighlight]
      .filter(Boolean)
      .reduce((res, highlight) => {
        const { pageNumber } = highlight.position;

        res[pageNumber] = res[pageNumber] || [];
        res[pageNumber].push(highlight);

        return res;
      }, {});
  }

  showTip(highlight: T_ViewportHighlight<T_HT>, content: React$Element<*>) {
    const {
      isCollapsed,
      ghostHighlight,
      isAreaSelectionInProgress
    } = this.state;

    const highlightInProgress = !isCollapsed || ghostHighlight.length;

    if (highlightInProgress || isAreaSelectionInProgress) {
      return;
    }

    this.renderTipAtPosition(highlight.position, content);
  }

  scaledPositionToViewport({
    pageNumber,
    boundingRect,
    rects,
    usePdfCoordinates
  }: T_ScaledPosition): T_Position {
    const viewport = this.viewer.getPageView(pageNumber - 1).viewport;

    return {
      boundingRect: scaledToViewport(boundingRect, viewport, usePdfCoordinates),
      rects: (rects || []).map(rect =>
        scaledToViewport(rect, viewport, usePdfCoordinates)
      ),
      pageNumber
    };
  }

  viewportPositionToScaled({
    pageNumber,
    boundingRect,
    rects
  }: T_Position): T_ScaledPosition {
    const viewport = this.viewer.getPageView(pageNumber - 1).viewport;

    return {
      boundingRect: viewportToScaled(boundingRect, viewport),
      rects: (rects || []).map(rect => viewportToScaled(rect, viewport)),
      pageNumber
    };
  }

  screenshot(position: T_LTWH, pageNumber: number) {
    const canvas = this.viewer.getPageView(pageNumber - 1).canvas;

    return getAreaAsPng(canvas, position);
  }

  renderHighlights(nextProps?: Props<T_HT>) {
    const { highlightTransform, highlights } = nextProps || this.props;

    const { pdfDocument } = this.props;

    const { tip, scrolledToHighlightId } = this.state;

    const highlightsByPage = this.groupHighlightsByPage(highlights);

    for (let pageNumber = 1; pageNumber <= pdfDocument.numPages; pageNumber++) {
      const highlightLayer = this.findOrCreateHighlightLayer(pageNumber);

      if (highlightLayer) {
        ReactDom.render(
          <div>
            {(highlightsByPage[String(pageNumber)] || []).map(
              ({ position, id, ...highlight }, index) => {
                const viewportHighlight: T_ViewportHighlight<T_HT> = {
                  id,
                  position: this.scaledPositionToViewport(position),
                  ...highlight
                };

                if (tip && tip.highlight.id === String(id)) {
                  this.showTip(tip.highlight, tip.callback(viewportHighlight));
                }

                const isScrolledTo = Boolean(scrolledToHighlightId === id);

                return highlightTransform(
                  viewportHighlight,
                  index,
                  (highlight, callback) => {
                    this.setState({
                      tip: { highlight, callback }
                    });

                    this.showTip(highlight, callback(highlight));
                  },
                  this.hideTipAndSelection,
                  rect => {
                    const viewport = this.viewer.getPageView(pageNumber - 1)
                      .viewport;

                    return viewportToScaled(rect, viewport);
                  },
                  boundingRect => {
                    // this.screenshot(boundingRect, pageNumber);
                  },
                  isScrolledTo
                );
              }
            )}
          </div>,
          highlightLayer
        );
      }
    }
  }

  hideTipAndSelection = () => {
    const tipNode = findOrCreateContainerLayer(
      this.viewer.viewer,
      "PdfHighlighter__tip-layer"
    );

    ReactDom.unmountComponentAtNode(tipNode);

    this.setState({ ghostHighlight: [], tip: null }, () =>
      this.renderHighlights()
    );
  };

  renderTipAtPosition(
    position: T_Position,
    inner: ?React$Element<*>,
    showAbsoluteContainer: boolean
  ) {
    const { boundingRect, pageNumber } = position;

    const page = {
      node: this.viewer.getPageView(pageNumber - 1).div
    };

    const pageBoundingRect = page.node.getBoundingClientRect();

    const tipNode = findOrCreateContainerLayer(
      this.viewer.viewer,
      "PdfHighlighter__tip-layer"
    );

    ReactDom.render(
      <TipContainer
        scrollTop={this.viewer.container.scrollTop}
        pageBoundingRect={pageBoundingRect}
        style={{
          left:
            page.node.offsetLeft + boundingRect.left + boundingRect.width / 2,
          top: boundingRect.top + page.node.offsetTop,
          bottom: boundingRect.top + page.node.offsetTop + boundingRect.height
        }}
        children={inner}
        showAbsoluteContainer={showAbsoluteContainer}
      />,
      tipNode
    );
  }

  onTextLayerRendered = () => {
    this.renderHighlights();
  };

  scrollTo = (highlight: T_Highlight) => {
    const { pageNumber, boundingRect, usePdfCoordinates } = highlight.position;

    this.viewer.container.removeEventListener("scroll", this.onScroll);

    const pageViewport = this.viewer.getPageView(pageNumber - 1).viewport;

    const scrollMargin = 10;

    this.viewer.scrollPageIntoView({
      pageNumber,
      destArray: [
        null,
        { name: "XYZ" },
        ...pageViewport.convertToPdfPoint(
          0,
          scaledToViewport(boundingRect, pageViewport, usePdfCoordinates).top -
            scrollMargin
        ),
        0
      ]
    });

    this.setState(
      {
        scrolledToHighlightId: highlight.id
      },
      () => this.renderHighlights()
    );

    // wait for scrolling to finish
    setTimeout(() => {
      this.viewer.container.addEventListener("scroll", this.onScroll);
    }, 100);
  };

  onDocumentReady = () => {
    const { scrollRef } = this.props;

    this.handleScaleValue();

    scrollRef(this.scrollTo);
  };

  onSelectionChange = () => {
    const container = this.containerNode;
    const selection: Selection = getWindow(container).getSelection();
    const range = selection.rangeCount > 0 ? selection.getRangeAt(0) : null;

    if (selection.isCollapsed) {
      this.setState({ isCollapsed: true });
      return;
    }

    if (
      !range ||
      !container ||
      !container.contains(range.commonAncestorContainer)
    ) {
      return;
    }

    //to save highlight in more than one page
    if (selection.rangeCount) {
      let tempRangeArray = [];
      for (let i = 0; i < selection.rangeCount; i = i + 2) {
        const thisRange = selection.getRangeAt(i);
        tempRangeArray.push(thisRange);
      }
      this.setState(state => ({
        ...state,
        rangeArray: tempRangeArray
      }));
    }

    this.setState({
      isCollapsed: false,
      range
    });

    this.debouncedAfterSelection();
  };

  onScroll = () => {
    const { onScrollChange } = this.props;

    onScrollChange();

    this.setState(
      {
        scrolledToHighlightId: EMPTY_ID
      },
      () => this.renderHighlights()
    );

    this.viewer.container.removeEventListener("scroll", this.onScroll);
  };

  onMouseDown = (event: MouseEvent) => {
    if (!isHTMLElement(event.target)) {
      return;
    }

    if (asElement(event.target).closest(".PdfHighlighter__tip-container")) {
      return;
    }

    this.hideTipAndSelection();
  };

  handleKeyDown = (event: KeyboardEvent) => {
    if (event.code === "Escape") {
      this.hideTipAndSelection();
    }
  };

  handleClick = (event: MouseEvent) => {
    let obj = document.getElementsByClassName("PdfHighlighter")[0];
    let obj_left = 0;
    let obj_top = 0;
    let xpos;
    let ypos;
    while (obj.offsetParent) {
      obj_left += obj.offsetLeft;
      obj_top += obj.offsetTop;
      obj = obj.offsetParent;
    }
    if (event) {
      //FireFox
      xpos = event.pageX;
      ypos = event.pageY;
    } else {
      //IE
      xpos = window.event.x + document.body.scrollLeft - 2;
      ypos = window.event.y + document.body.scrollTop - 2;
    }
    xpos -= obj_left;
    ypos -= obj_top;

    this.setState({
      clientPosition: {
        xPos: xpos,
        yPos: ypos,
        viewer: this.viewer
      }
    });
  };

  getHighlightArray = () => {
    const { rangeArray, isCollapsed } = this.state;
    const tempHighlightArray = [];

    if (!rangeArray.length || isCollapsed) {
      return;
    }

    rangeArray.length &&
      rangeArray.map(range => {
        const page = getPageFromRange(range);

        if (!page) {
          return;
        }

        const rects = getClientRects(range, page.node);

        if (rects.length === 0) {
          return;
        }

        const boundingRect = getBoundingRect(rects);

        const viewportPosition = {
          boundingRect,
          rects,
          pageNumber: page.number
        };
        const content = {
          text: range.toString()
        };

        const scaledPosition = this.viewportPositionToScaled(viewportPosition);

        const tempHighlight = {
          position: scaledPosition,
          content
        };

        tempHighlightArray.push(tempHighlight);
      });

    return tempHighlightArray;
  };

  afterSelection = () => {
    const { onSelectionFinished } = this.props;

    const { isCollapsed, range, clientPosition } = this.state;

    if (!range || isCollapsed) {
      return;
    }

    const page = getPageFromRange(range);

    if (!page) {
      return;
    }

    const rects = getClientRects(range, page.node);

    if (rects.length === 0) {
      return;
    }

    const boundingRect = getBoundingRect(rects);

    const viewportPosition = { boundingRect, rects, pageNumber: page.number };
    const content = {
      text: range.toString()
    };

    const scaledPosition = this.viewportPositionToScaled(viewportPosition);

    const highlightArray = this.getHighlightArray();

    this.renderTipAtPosition(
      viewportPosition,
      onSelectionFinished(
        scaledPosition,
        content,
        () => this.hideTipAndSelection(),
        () =>
          this.setState(
            {
              ghostHighlight: highlightArray
                ? [...highlightArray, { position: scaledPosition }]
                : [{ position: scaledPosition }]
            },
            () => this.renderHighlights()
          ),
        clientPosition,
        highlightArray
      ),
      true
    );
  };

  debouncedAfterSelection: () => void = debounce(this.afterSelection, 500);

  toggleTextSelection(flag: boolean) {
    this.viewer.viewer.classList.toggle(
      "PdfHighlighter--disable-selection",
      flag
    );
  }

  handleScaleValue = () => {
    if (this.viewer) {
      this.viewer.currentScaleValue = this.props.pdfScaleValue; //"page-width";
    }
  };

  debouncedScaleValue: () => void = debounce(this.handleScaleValue, 500);

  toggleAreaHighlight = areaHighlightEnable => {
    this.setState({
      areaHighlightEnable
    });
  };

  rotatePages = delta => {
    const { pdfDocument } = this.props;
    if (!pdfDocument) {
      return;
    }
    const newRotation = (this.viewer.pagesRotation + 360 + delta) % 360;
    this.viewer.pagesRotation = newRotation;
    // Note that the thumbnail viewer is updated, and rendering is triggered,
    // in the 'rotationchanging' event handler.
  };

  saveRotation = () => this.props.saveRotation(this.viewer.pagesRotation);

  rotationModalConfirmation = () =>
    this.props.rotationModalConfirmation(this.rotatePages);

  render() {
    const {
      onSelectionFinished,
      enableAreaSelection,
      showToolBar,
      updateRotate,
      showRotationWarning,
      showRotationWarningFunc,
      rotationModalConfirmation
    } = this.props;
    const { areaHighlightEnable } = this.state;

    return (
      <React.Fragment>
        {showToolBar && showToolBar.length ? (
          <ToolBar
            areaHighlightEnable={areaHighlightEnable}
            toggleAreaHighlight={this.toggleAreaHighlight}
            showToolBar={showToolBar}
            showRotationWarning={showRotationWarning}
            showRotationWarningFunc={showRotationWarningFunc}
            rotatePages={delta => updateRotate(this.rotatePages, delta)}
            saveRotation={this.saveRotation}
          />
        ) : (
          ""
        )}

        <Pointable onPointerDown={this.onMouseDown}>
          <div
            ref={this.attachRef}
            className="PdfHighlighter"
            onContextMenu={e => e.preventDefault()}
          >
            <div className="pdfViewer" />
            {typeof enableAreaSelection === "function" ? (
              <MouseSelection
                onDragStart={() => this.toggleTextSelection(true)}
                onDragEnd={() => this.toggleTextSelection(false)}
                onChange={isVisible =>
                  this.setState({ isAreaSelectionInProgress: isVisible })
                }
                shouldStart={event =>
                  (enableAreaSelection(event) ||
                    this.state.areaHighlightEnable) &&
                  isHTMLElement(event.target) &&
                  Boolean(asElement(event.target).closest(".page"))
                }
                onSelection={(startTarget, boundingRect, resetSelection) => {
                  const page = getPageFromElement(startTarget);

                  if (!page) {
                    return;
                  }

                  const pageBoundingRect = {
                    ...boundingRect,
                    top: boundingRect.top - page.node.offsetTop,
                    left: boundingRect.left - page.node.offsetLeft
                  };

                  const viewportPosition = {
                    boundingRect: pageBoundingRect,
                    rects: [],
                    pageNumber: page.number
                  };

                  const scaledPosition = this.viewportPositionToScaled(
                    viewportPosition
                  );

                  const image = this.screenshot(pageBoundingRect, page.number);

                  this.renderTipAtPosition(
                    viewportPosition,
                    onSelectionFinished(
                      scaledPosition,
                      {
                        image
                      },
                      () => this.hideTipAndSelection(),
                      () =>
                        this.setState(
                          {
                            ghostHighlight: [
                              {
                                position: scaledPosition,
                                content: {
                                  image
                                }
                              }
                            ]
                          },
                          () => {
                            resetSelection();
                            this.renderHighlights();
                          }
                        )
                    )
                  );
                }}
              />
            ) : null}
          </div>
        </Pointable>

        {rotationModalConfirmation ? this.rotationModalConfirmation() : ""}
      </React.Fragment>
    );
  }
}

export default PdfHighlighter;
