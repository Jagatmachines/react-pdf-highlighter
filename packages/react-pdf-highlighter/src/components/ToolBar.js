// @flow

import React, { Component } from "react";

import "../style/ToolBar.css";

import type { T_ToolBarItem } from "../types";
import { highlighterBox, areaHighlighterBox, rotationBox } from "../constant";

type Props = {
  areaHighlightEnable: boolean,
  toggleAreaHighlight: () => void,
  showToolBar: T_ToolBarItem,
  rotatePages: (delta: number) => void,
  saveRotation?: (delta: number) => void
};

class ToolBar extends Component<Props> {
  constructor(props: Props) {
    super(props);
  }

  render() {
    const {
      areaHighlightEnable,
      toggleAreaHighlight,
      showToolBar,
      rotatePages,
      initialHighlight,
      saveRotation
    } = this.props;

    return (
      <React.Fragment>
        <div className="toolbar">
          {/* <button
          className="cursor"
          type="button"
          title="Cursor"
          data-tooltype="cursor"
        >
          ➚
        </button>

        <div className="spacer"></div> */}

          {showToolBar.includes(areaHighlighterBox) ? (
            <React.Fragment>
              <button
                className={`rectangle tooltip ${
                  areaHighlightEnable ? "active" : ""
                }`}
                type="button"
                data-tooltype="area"
                onClick={() => {
                  toggleAreaHighlight(true);
                }}
              >
                <span className="tooltip__text">Image Highlighter</span>
              </button>
              <div className="spacer"></div>
            </React.Fragment>
          ) : (
            ""
          )}

          {showToolBar.includes(highlighterBox) ? (
            <React.Fragment>
              <button
                className={`highlight tooltip ${
                  !areaHighlightEnable ? "active" : ""
                }`}
                type="button"
                data-tooltype="highlight"
                onClick={() => {
                  toggleAreaHighlight(false);
                }}
              >
                <span className="tooltip__text">Text Highlighter</span>
              </button>
              <div className="spacer"></div>
            </React.Fragment>
          ) : (
            ""
          )}

          {showToolBar.includes(rotationBox) ? (
            <React.Fragment>
              <button
                className="rotate-ccw"
                type="button"
                onClick={() => {
                  rotatePages(-90);
                  // toggleAreaHighlight(false);
                }}
              >
                ⟲<span className="tooltip__text">Rotate Counter Clockwise</span>
              </button>

              <button
                className="rotate-ccw"
                type="button"
                onClick={() => {
                  rotatePages(90);
                  // toggleAreaHighlight(false);
                }}
              >
                ⟳<span className="tooltip__text">Rotate Clockwise</span>
              </button>
              <button onClick={saveRotation}>Save Rotation</button>
            </React.Fragment>
          ) : (
            ""
          )}

          {/* <a
          href="javascript://"
          
          title="Rotate Counter Clockwise"
        >
          
        </a>
        <a href="javascript://" className="rotate-cw" title="Rotate Clockwise">
          ⟳
        </a> */}

          {/* <button
          className="strikeout active"
          type="button"
          title="Strikeout"
          data-tooltype="strikeout"
        >
          &nbsp;
        </button> */}

          {/* <div className="spacer"></div>

        <button
          className="text"
          type="button"
          title="Text Tool"
          data-tooltype="text"
        ></button>
        <select className="text-size">
          <option value="8">8</option>
          <option value="9">9</option>
          <option value="10">10</option>
          <option value="11">11</option>
          <option value="12">12</option>
          <option value="14">14</option>
          <option value="18">18</option>
          <option value="24">24</option>
          <option value="30">30</option>
          <option value="36">36</option>
          <option value="48">48</option>
          <option value="60">60</option>
          <option value="72">72</option>
          <option value="96">96</option>
        </select>
        <div className="text-color">
          <a
            className="color"
            href="javascript://"
            title="undefined"
            data-color="#43A047"
            style={{
              background: "rgb(67, 160, 71)"
            }}
          ></a>
        </div>

        <div className="spacer"></div>

        <button
          className="pen"
          type="button"
          title="Pen Tool"
          data-tooltype="draw"
        >
          ✎
        </button>
        <select className="pen-size">
          <option value="1">1</option>
          <option value="2">2</option>
          <option value="3">3</option>
          <option value="4">4</option>
          <option value="5">5</option>
          <option value="6">6</option>
          <option value="7">7</option>
          <option value="8">8</option>
          <option value="9">9</option>
          <option value="10">10</option>
          <option value="11">11</option>
          <option value="12">12</option>
          <option value="13">13</option>
          <option value="14">14</option>
          <option value="15">15</option>
          <option value="16">16</option>
          <option value="17">17</option>
          <option value="18">18</option>
          <option value="19">19</option>
          <option value="20">20</option>
        </select>
        <div className="pen-color">
          <a
            className="color"
            href="javascript://"
            title="undefined"
            data-color="#000000"
            style={{
              background: "rgb(0, 0, 0)"
            }}
          ></a>
        </div>

        <div className="spacer"></div>

        <button
          className="comment"
          type="button"
          title="Comment"
          data-tooltype="point"
        >
          🗨
        </button>

        <div className="spacer"></div>

        <select className="scale">
          <option value=".5">50%</option>
          <option value="1">100%</option>
          <option value="1.33">133%</option>
          <option value="1.5">150%</option>
          <option value="2">200%</option>
        </select>

        <a
          href="javascript://"
          className="rotate-ccw"
          title="Rotate Counter Clockwise"
        >
          ⟲
        </a>
        <a href="javascript://" className="rotate-cw" title="Rotate Clockwise">
          ⟳
        </a>

        <div className="spacer"></div>

        <a href="javascript://" className="clear" title="Clear">
          ×
        </a> */}
        </div>
        {initialHighlight ? (
          <span className="toolbar-static-banner">
            Please correct document orientation before annotation. Changing
            document orientation after annotation will lead to loss of the
            previous annotation
          </span>
        ) : (
          ""
        )}
      </React.Fragment>
    );
  }
}

export default ToolBar;